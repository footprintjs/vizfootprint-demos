/**
 * AN ARCHIVE SMALL ENOUGH TO COUNT BY HAND — the fixture the exoplanet tests
 * share, as the archive's own CSV text so the parse is exercised too.
 *
 * Two planets, and every fact the real slice has once each:
 *
 *   Demo-1 b   three published solutions. One measures radius and mass; one can
 *              only BOUND the radius (`pl_radelim` = 1); one is the archive's
 *              default. Two of the three cite ONE reference the archive spells
 *              two different ways — the reason `ref` and not the anchor is the
 *              key.
 *   Demo-2 b   one published solution, no radius at all, an `Msini` mass, and
 *              NO default flag anywhere: a planet the composite has and the
 *              literature never settled.
 *
 * The composite disagrees with both on purpose: Demo-1 b's radius there comes
 * from `CALCULATED_VALUE` (the archive's own calculation, not a paper), and
 * Demo-2 b's from a publication no confirmed measurement row cites — so
 * `cited_in` has one of each of its three words.
 *
 * Not a `.test.ts`, so vitest never runs it as a suite (`tests/**\/*.test.*`).
 */

/** An ADS-backed anchor, the way the archive ships one. */
const paper = (refstr: string, label: string, id: string): string => `<a refstr=${refstr} href=https://ui.adsabs.harvard.edu/abs/${id}/abstract target=ref>${label}</a>`;
/** The archive's own calculation — a relative href, which is what makes it `archive` rather than `publication`. */
const CALCULATED = '<a refstr=CALCULATED_VALUE href=/docs/pscp_calc.html target=_blank>Calculated Value</a>';

export const ONE = paper('PAPER_ONE__2001', 'Paper One et al. 2001', '2001ApJ...001....1A');
/** The SAME key, spelled a second way — a leading space in the label, which is exactly what the archive does. */
export const ONE_AGAIN = paper('PAPER_ONE__2001', ' Paper One et al. 2001 ', '2001ApJ...001....1B');
export const TWO = paper('PAPER_TWO__2005', 'Paper Two et al. 2005', '2005ApJ...005....5C');
export const THREE = paper('PAPER_THREE__2010', 'Paper Three et al. 2010', '2010ApJ...010...10D');

const PS_HEADER =
  'pl_name,hostname,pl_letter,sy_pnum,soltype,default_flag,pl_refname,pl_pubdate,pl_orbper,pl_rade,pl_radeerr1,pl_radeerr2,pl_radelim,pl_bmasse,pl_bmasseerr1,pl_bmasseerr2,pl_bmasselim,pl_bmassprov,disc_year,discoverymethod,sy_dist';

/** `ps.csv` in miniature, in the committed file's own order (`pl_name, pl_pubdate, pl_refname`). */
export const TINY_PS = [
  PS_HEADER,
  // a measurement of both, cited by the reference the composite also uses for its mass
  `"Demo-1 b","Demo-1","b",1,"Published Confirmed",0,"${ONE}","2001-01",3.5,2.00,0.10,-0.10,0,5.00,0.50,-0.50,0,"Mass",2001,"Transit",12.5`,
  // the radius is a BOUND, and there is no mass at all
  `"Demo-1 b","Demo-1","b",1,"Published Confirmed",0,"${TWO}","2005-06",3.5,2.40,,,1,,,,,"",2001,"Transit",12.5`,
  // the archive's default solution, citing the SAME reference as the first row under a second anchor
  `"Demo-1 b","Demo-1","b",1,"Published Confirmed",1,"${ONE_AGAIN}","2009-03",3.5,2.20,0.05,-0.05,0,5.40,0.20,-0.20,0,"Mass",2001,"Transit",12.5`,
  // one solution, no radius, an Msini mass — and nothing marked default
  `"Demo-2 b","Demo-2","b",2,"Published Confirmed",0,"${TWO}","2005-06",88.0,,,,,300.00,10.00,-10.00,0,"Msini",2004,"Radial Velocity",30.0`,
  '',
].join('\n');

const PSCOMPPARS_HEADER = 'pl_name,hostname,pl_letter,sy_pnum,pl_orbper,pl_orbper_reflink,pl_rade,pl_radelim,pl_rade_reflink,pl_bmasse,pl_bmasselim,pl_bmassprov,pl_bmasse_reflink,disc_year,discoverymethod,disc_refname,sy_dist';

/** `pscomppars.csv` in miniature — one row per planet, each parameter with its own reference. */
export const TINY_PSCOMPPARS = [
  PSCOMPPARS_HEADER,
  // the accepted radius came from NO paper; the accepted mass came from Paper One
  `"Demo-1 b","Demo-1","b",1,3.5,"${ONE}",2.10,0,"${CALCULATED}",5.20,0,"Mass","${ONE}",2001,"Transit","${ONE}",12.5`,
  // the accepted radius cites a publication no confirmed measurement row cites
  `"Demo-2 b","Demo-2","b",2,88.0,"${TWO}",9.90,0,"${THREE}",300.00,0,"Msini","${TWO}",2004,"Radial Velocity","${THREE}",30.0`,
  '',
].join('\n');
