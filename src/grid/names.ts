/**
 * NAMES — the one thing the bulk files do not carry.
 *
 * EIA-930's six-month CSVs identify a balancing authority by a short code
 * (`AECI`, `CISO`, `SWPP`) and a region by another (`MIDW`, `CAL`, `TEX`), and
 * that is all. The long names below come from EIA's published list of Form
 * EIA-930 respondents and of the Hourly Electric Grid Monitor's regions — a
 * separate document, not the data — so they are the only field in
 * `src/grid/etl.ts` that is TYPED IN rather than read.
 *
 * Because it is typed in, it is allowed to be incomplete: a code with no entry
 * here gets `name: null` and `name_state: 'unknown'` in the authorities table.
 * It never gets its own code echoed back as if that were a name, and it never
 * gets a guess. That is the same law the rest of the ETL runs on.
 *
 * The eight codes under CAN and MEX are the interties: they appear only as the
 * far end of a flow, never as a reporting authority, so their names are how a
 * reader learns that the edge leaves the country.
 */

/** Region code → the name EIA prints for it; `CAN` and `MEX` are the two that are not EIA regions at all. */
export const REGION_NAMES: Readonly<Record<string, string>> = {
  CAL: 'California',
  CAR: 'Carolinas',
  CENT: 'Central',
  FLA: 'Florida',
  MIDA: 'Mid-Atlantic',
  MIDW: 'Midwest',
  NE: 'New England',
  NW: 'Northwest',
  NY: 'New York',
  SE: 'Southeast',
  SW: 'Southwest',
  TEN: 'Tennessee',
  TEX: 'Texas',
  CAN: 'Canada',
  MEX: 'Mexico',
};

/** Balancing authority code → the name EIA prints for it. */
export const AUTHORITY_NAMES: Readonly<Record<string, string>> = {
  AECI: 'Associated Electric Cooperative, Inc.',
  AVA: 'Avista Corporation',
  AVRN: 'Avangrid Renewables, LLC',
  AZPS: 'Arizona Public Service Company',
  BANC: 'Balancing Authority of Northern California',
  BPAT: 'Bonneville Power Administration',
  CHPD: 'PUD No. 1 of Chelan County',
  CISO: 'California Independent System Operator',
  CPLE: 'Duke Energy Progress East',
  CPLW: 'Duke Energy Progress West',
  DEAA: 'Arlington Valley, LLC',
  DOPD: 'PUD No. 1 of Douglas County',
  DUK: 'Duke Energy Carolinas',
  EPE: 'El Paso Electric Company',
  ERCO: 'Electric Reliability Council of Texas, Inc.',
  FMPP: 'Florida Municipal Power Pool',
  FPC: 'Duke Energy Florida, Inc.',
  FPL: 'Florida Power & Light Company',
  GCPD: 'PUD No. 2 of Grant County, Washington',
  GRID: 'Gridforce Energy Management, LLC',
  GVL: 'Gainesville Regional Utilities',
  GWA: 'NaturEner Power Watch, LLC',
  HGMA: 'New Harquahala Generating Company, LLC',
  HST: 'City of Homestead',
  IID: 'Imperial Irrigation District',
  IPCO: 'Idaho Power Company',
  ISNE: 'ISO New England Inc.',
  JEA: 'JEA',
  LDWP: 'Los Angeles Department of Water and Power',
  LGEE: 'Louisville Gas and Electric Company and Kentucky Utilities Company',
  MISO: 'Midcontinent Independent System Operator, Inc.',
  NEVP: 'Nevada Power Company',
  NWMT: 'NorthWestern Energy',
  NYIS: 'New York Independent System Operator',
  PACE: 'PacifiCorp East',
  PACW: 'PacifiCorp West',
  PGE: 'Portland General Electric Company',
  PJM: 'PJM Interconnection, LLC',
  PNM: 'Public Service Company of New Mexico',
  PSCO: 'Public Service Company of Colorado',
  PSEI: 'Puget Sound Energy',
  SC: 'South Carolina Public Service Authority',
  SCEG: 'Dominion Energy South Carolina',
  SCL: 'Seattle City Light',
  SEC: 'Seminole Electric Cooperative',
  SEPA: 'Southeastern Power Administration',
  SIKE: 'City of Sikeston Board of Municipal Utilities',
  SOCO: 'Southern Company Services, Inc. — Transmission',
  SPA: 'Southwestern Power Administration',
  SRP: 'Salt River Project Agricultural Improvement and Power District',
  SWPP: 'Southwest Power Pool',
  TAL: 'City of Tallahassee',
  TEC: 'Tampa Electric Company',
  TEPC: 'Tucson Electric Power Company',
  TIDC: 'Turlock Irrigation District',
  TPWR: 'City of Tacoma, Department of Public Utilities, Light Division',
  TVA: 'Tennessee Valley Authority',
  WACM: 'Western Area Power Administration — Rocky Mountain Region',
  WALC: 'Western Area Power Administration — Desert Southwest Region',
  WAUW: 'Western Area Power Administration — Upper Great Plains West',
  WWA: 'NaturEner Wind Watch, LLC',
  YAD: 'Alcoa Power Generating, Inc. — Yadkin Division',
  // the interties: named as a neighbour on an edge, never a reporting authority
  AESO: 'Alberta Electric System Operator',
  BCHA: 'British Columbia Hydro and Power Authority',
  CEN: 'Centro Nacional de Control de Energía',
  HQT: 'Hydro-Québec TransÉnergie',
  IESO: 'Independent Electricity System Operator (Ontario)',
  MHEB: 'Manitoba Hydro',
  NBSO: 'New Brunswick System Operator',
  SPC: 'Saskatchewan Power Corporation',
};

/** Where the two maps above came from — repeated into the slice's provenance, because a typed-in field must say so. */
export const NAMES_SOURCE =
  "EIA's published list of Form EIA-930 respondents and Hourly Electric Grid Monitor regions — a separate document from the bulk CSVs, which carry codes only; a code with no entry is left unnamed, never guessed";
