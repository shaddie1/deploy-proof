// Constants for PCB Repair Tracker — mirrors reference app structure

export interface BatchInfo {
  label: string;
  deviceType: string;
  cookerModel: string;
  units: number | string;
}

export interface CompanyInfo {
  name: string;
  flag: string;
}

// Maps project names to company info
export const COMPANIES: CompanyInfo[] = [
  { name: "Nyalore", flag: "🇰🇪" },
  { name: "MECs Uganda", flag: "🇺🇬" },
  { name: "Positive Ayin Tanzania", flag: "🇹🇿" },
  { name: "MECS Uganda", flag: "🇺🇬" },
  { name: "Naconek", flag: "🇰🇪" },
  { name: "IGNIS Innovation", flag: "🇰🇪" },
];

export const COMPANY_BATCHES: Record<string, BatchInfo[]> = {
  Nyalore: [
    { label: "Bunch 1", deviceType: "External Metering", cookerModel: "Tefal Pressure Cooker", units: 150 },
    { label: "Bunch 2", deviceType: "Internal Metering", cookerModel: "Tefal Pressure Cooker", units: 305 },
  ],
  "MECs Uganda": [
    { label: "Batch 1", deviceType: "Internal Metering", cookerModel: "Mecs DC Pressure Cooker", units: 50 },
  ],
  "MECS Uganda": [
    { label: "Batch 1", deviceType: "Internal Metering", cookerModel: "Mecs DC Pressure Cooker", units: 50 },
  ],
  "Positive Ayin Tanzania": [
    { label: "Batch 1", deviceType: "Internal Metering", cookerModel: "Induction Cooker", units: 400 },
  ],
  Naconek: [
    { label: "Batch 1", deviceType: "External Metering", cookerModel: "Tefal Pressure Cooker", units: 100 },
  ],
  "IGNIS Innovation": [
    { label: "Batch 1", deviceType: "External Metering", cookerModel: "Tefal Pressure Cooker", units: 100 },
  ],
};

export const COMPANY_ORIGINS: Record<string, string[]> = {
  Nyalore: ["Naivasha", "Nakuru", "Eldoret", "Kitale", "Kisumu", "Busia", "Homabay", "Migori", "Kilifi", "Mombasa"],
  "MECs Uganda": ["Kampala", "Jinja", "Mbale", "Gulu", "Mbarara", "Fort Portal", "Lira", "Soroti"],
  "MECS Uganda": ["Kampala", "Jinja", "Mbale", "Gulu", "Mbarara", "Fort Portal", "Lira", "Soroti"],
  "Positive Ayin Tanzania": ["Dar es Salaam", "Arusha", "Mwanza", "Dodoma", "Moshi", "Tanga", "Morogoro", "Zanzibar"],
  Naconek: ["Nairobi", "Mombasa", "Kisumu", "Nakuru", "Eldoret", "Thika"],
  "IGNIS Innovation": ["Nairobi", "Mombasa", "Kisumu", "Nakuru", "Eldoret", "Thika"],
};

export const FAULT_CATEGORIES = [
  "Short Circuit",
  "Open Circuit",
  "Component Failure",
  "Broken Trace",
  "Relay Failure",
  "Firmware Issue",
  "Burnt Component",
  "Connector/Soldering Issue",
  "Mechanical Damage",
  "Sensor Fault",
  "Power Supply",
  "Overvoltage/ESD",
  "Cooker Lid Fault",
  "Cooker Heating Element",
  "Other",
];
