import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify the user
    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authErr } = await anonClient.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { batch_id } = await req.json();
    if (!batch_id) {
      return new Response(JSON.stringify({ error: "batch_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch stock batch
    const { data: batch, error: batchErr } = await supabase
      .from("stock_batches")
      .select("*, items(name, category, unit_of_measure), shipments(supplier, origin_country, quantity, status, expected_arrival, actual_arrival, created_at)")
      .eq("id", batch_id)
      .single();

    if (batchErr || !batch) {
      return new Response(JSON.stringify({ error: "Stock batch not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch deployments from this batch
    const { data: deployments } = await supabase
      .from("deployments")
      .select("*, items(name), projects(name)")
      .eq("stock_batch_id", batch_id)
      .order("deployment_date", { ascending: true });

    // Fetch evidence linked to batch, shipment, or deployments
    const entityIds = [batch_id, batch.shipment_id, ...(deployments || []).map((d: any) => d.id)];
    const { data: evidence } = await supabase
      .from("evidence_files")
      .select("*")
      .in("linked_entity_id", entityIds)
      .order("created_at", { ascending: true });

    // Fetch adjustments
    const { data: adjustments } = await supabase
      .from("stock_adjustments")
      .select("*")
      .eq("stock_batch_id", batch_id)
      .order("created_at", { ascending: true });

    const now = new Date().toISOString();
    const shipment = batch.shipments;
    const item = batch.items;

    // Build timeline events
    const timeline: { date: string; event: string; detail: string }[] = [];

    if (shipment) {
      timeline.push({ date: shipment.created_at, event: "Shipment Created", detail: `${shipment.quantity} ${item?.unit_of_measure || "units"} ordered from ${shipment.supplier} (${shipment.origin_country})` });
      if (shipment.actual_arrival) {
        timeline.push({ date: shipment.actual_arrival, event: "Shipment Received", detail: `${batch.quantity_received} ${item?.unit_of_measure || "units"} received in ${batch.condition || "good"} condition` });
      }
    }

    (adjustments || []).forEach((adj: any) => {
      timeline.push({ date: adj.created_at, event: "Stock Adjustment", detail: `${adj.quantity_change > 0 ? "+" : ""}${adj.quantity_change} — ${adj.reason}` });
    });

    (deployments || []).forEach((dep: any) => {
      timeline.push({ date: dep.deployment_date, event: `Deployment (${dep.status})`, detail: `${dep.quantity} units → ${dep.projects?.name || "Unknown Project"} at ${dep.location_name || "N/A"}` });
    });

    timeline.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Generate HTML report
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Chain-of-Custody Report — ${batch_id.slice(0, 8)}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', system-ui, sans-serif; color: #1a1a2e; padding: 40px; max-width: 900px; margin: 0 auto; font-size: 14px; }
  h1 { font-size: 22px; margin-bottom: 4px; }
  h2 { font-size: 16px; margin: 28px 0 12px; border-bottom: 2px solid #215ba6; padding-bottom: 4px; color: #215ba6; }
  .subtitle { color: #666; font-size: 13px; margin-bottom: 24px; }
  .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px; }
  .meta-box { background: #f5f7fa; border-radius: 6px; padding: 12px; }
  .meta-box label { font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 0.5px; }
  .meta-box .value { font-size: 15px; font-weight: 600; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; margin: 8px 0; }
  th, td { padding: 8px 10px; text-align: left; border-bottom: 1px solid #e0e0e0; font-size: 13px; }
  th { background: #f5f7fa; font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 0.3px; }
  .timeline-item { display: flex; gap: 16px; padding: 10px 0; border-left: 3px solid #215ba6; margin-left: 8px; padding-left: 16px; }
  .timeline-date { min-width: 90px; font-size: 12px; color: #888; }
  .timeline-event { font-weight: 600; }
  .timeline-detail { font-size: 13px; color: #555; }
  .hash { font-family: monospace; font-size: 11px; word-break: break-all; color: #555; }
  .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #ddd; font-size: 11px; color: #999; text-align: center; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; }
  .badge-success { background: #d4edda; color: #155724; }
  .badge-warning { background: #fff3cd; color: #856404; }
  .badge-info { background: #d1ecf1; color: #0c5460; }
  @media print { body { padding: 20px; } }
</style>
</head>
<body>
<h1>🔗 Chain-of-Custody Report</h1>
<p class="subtitle">Stock Batch ${batch_id} — Generated ${new Date(now).toLocaleString()}</p>

<div class="meta-grid">
  <div class="meta-box">
    <label>Item</label>
    <div class="value">${item?.name || "Unknown"}</div>
    <div style="font-size:12px;color:#888">${item?.category || ""} · ${item?.unit_of_measure || "unit"}</div>
  </div>
  <div class="meta-box">
    <label>Supplier</label>
    <div class="value">${shipment?.supplier || "N/A"}</div>
    <div style="font-size:12px;color:#888">${shipment?.origin_country || ""}</div>
  </div>
  <div class="meta-box">
    <label>Quantity Received</label>
    <div class="value">${batch.quantity_received}</div>
  </div>
  <div class="meta-box">
    <label>Current Stock</label>
    <div class="value">${batch.quantity_available} available · ${batch.quantity_deployed} deployed</div>
  </div>
</div>

<h2>📋 Lifecycle Timeline</h2>
${timeline.length > 0 ? timeline.map((t) => `
<div class="timeline-item">
  <div class="timeline-date">${new Date(t.date).toLocaleDateString()}</div>
  <div>
    <div class="timeline-event">${t.event}</div>
    <div class="timeline-detail">${t.detail}</div>
  </div>
</div>`).join("") : "<p style='color:#888;padding:12px'>No lifecycle events recorded.</p>"}

${(deployments || []).length > 0 ? `
<h2>🚀 Deployments (${deployments!.length})</h2>
<table>
  <thead><tr><th>Date</th><th>Project</th><th>Qty</th><th>Location</th><th>Status</th></tr></thead>
  <tbody>
    ${deployments!.map((d: any) => `<tr>
      <td>${d.deployment_date}</td>
      <td>${d.projects?.name || "—"}</td>
      <td>${d.quantity}</td>
      <td>${d.location_name || (d.gps_latitude ? d.gps_latitude.toFixed(4) + ", " + d.gps_longitude.toFixed(4) : "—")}</td>
      <td><span class="badge ${d.status === "verified" ? "badge-success" : d.status === "flagged" ? "badge-warning" : "badge-info"}">${d.status}</span></td>
    </tr>`).join("")}
  </tbody>
</table>` : ""}

${(evidence || []).length > 0 ? `
<h2>🔒 Evidence Files (${evidence!.length})</h2>
<table>
  <thead><tr><th>File</th><th>Event</th><th>Date</th><th>SHA-256 Hash</th></tr></thead>
  <tbody>
    ${evidence!.map((e: any) => `<tr>
      <td>${e.file_name}</td>
      <td>${e.event_type}</td>
      <td>${new Date(e.created_at).toLocaleDateString()}</td>
      <td class="hash">${e.sha256_hash}</td>
    </tr>`).join("")}
  </tbody>
</table>` : ""}

<div class="footer">
  <p>dMRV Tracker — Chain-of-Custody Report · Batch ${batch_id.slice(0, 8)}… · Generated ${new Date(now).toLocaleString()}</p>
  <p>This report is auto-generated. Evidence hashes can be independently verified against stored files.</p>
</div>
</body>
</html>`;

    return new Response(html, {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
