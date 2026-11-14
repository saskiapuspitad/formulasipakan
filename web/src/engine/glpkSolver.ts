// ============================================================================
// glpkSolver.ts — Adapter Solver untuk aplikasi (browser) memakai glpk.js.
// glpk.js berjalan penuh di browser (WebAssembly + Web Worker), sehingga
// perhitungan formulasi terjadi LOKAL/OFFLINE di ponsel peternak.
//
// Catatan: modul ini di-import HANYA di lingkungan browser. Di Node (pengujian)
// dipakai adapter lain (lihat pythonSolver.ts).
// ============================================================================
import type { LPModel, Solver, SolverResult, SolverStatus } from "./solver";

// glpk.js di-load dinamis agar tidak error saat modul lain di-import di Node.
export function createGlpkSolver(): Solver {
  let glpkPromise: Promise<any> | null = null;
  async function getGlpk(): Promise<any> {
    if (!glpkPromise) {
      const mod: any = await import("glpk.js");
      const factory = mod.default || mod;
      glpkPromise = Promise.resolve(factory());
    }
    return glpkPromise;
  }

  return {
    async solve(model: LPModel): Promise<SolverResult> {
      const glpk = await getGlpk();
      const boundType = (lb: number, ub: number) => {
        if (lb === ub) return glpk.GLP_FX;
        if (lb > -Infinity && ub < Infinity) return glpk.GLP_DB;
        if (lb > -Infinity) return glpk.GLP_LO;
        if (ub < Infinity) return glpk.GLP_UP;
        return glpk.GLP_FR;
      };
      const consBnds = (type: string, rhs: number) => {
        if (type === "eq") return { type: glpk.GLP_FX, lb: rhs, ub: rhs };
        if (type === "le") return { type: glpk.GLP_UP, lb: 0, ub: rhs };
        return { type: glpk.GLP_LO, lb: rhs, ub: 0 }; // ge
      };
      const lp = {
        name: model.name,
        objective: {
          direction: glpk.GLP_MIN,
          name: "biaya",
          vars: model.vars.map((v) => ({ name: v.name, coef: v.cost })),
        },
        subjectTo: model.constraints.map((c) => ({
          name: c.name,
          vars: Object.entries(c.coeffs).map(([name, coef]) => ({ name, coef })),
          bnds: consBnds(c.type, c.rhs),
        })),
        bounds: model.bounds.map((b) => ({
          name: b.name,
          type: boundType(b.lb, b.ub),
          lb: b.lb,
          ub: b.ub,
        })),
      };
      const res = await glpk.solve(lp, { msglev: glpk.GLP_MSG_OFF });
      const r = res.result;
      let status: SolverStatus = "error";
      if (r.status === glpk.GLP_OPT) status = "optimal";
      else if (r.status === glpk.GLP_NOFEAS || r.status === glpk.GLP_INFEAS) status = "infeasible";
      else if (r.status === glpk.GLP_UNBND) status = "unbounded";
      return {
        status,
        objective: status === "optimal" ? r.z : null,
        values: r.vars || {},
      };
    },
  };
}
