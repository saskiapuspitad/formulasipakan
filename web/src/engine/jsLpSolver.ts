// ============================================================================
// jsLpSolver.ts — Adapter Solver berbasis "javascript-lp-solver" (JS murni).
// Tanpa WebAssembly/Web Worker sehingga andal di semua browser & PWA offline.
// Model LP kanonik yang sama dengan adapter lain -> hasil setara.
// ============================================================================
import solver from "javascript-lp-solver";
import type { LPModel, Solver, SolverResult } from "./solver";

export function createJsLpSolver(): Solver {
  return {
    async solve(model: LPModel): Promise<SolverResult> {
      const constraints: Record<string, any> = {};
      const variables: Record<string, any> = {};

      // kendala eksplisit
      for (const c of model.constraints) {
        if (c.type === "eq") constraints[c.name] = { equal: c.rhs };
        else if (c.type === "le") constraints[c.name] = { max: c.rhs };
        else constraints[c.name] = { min: c.rhs };
      }
      // batas variabel (lb/ub) -> jadikan kendala per-variabel
      for (const b of model.bounds) {
        const cname = `__b_${b.name}`;
        const cc: any = {};
        if (b.lb > -Infinity) cc.min = b.lb;
        if (b.ub < Infinity) cc.max = b.ub;
        constraints[cname] = cc;
      }
      // variabel: koefisien objektif + koefisien di tiap kendala
      for (const v of model.vars) {
        const vv: Record<string, number> = { __cost: v.cost, [`__b_${v.name}`]: 1 };
        variables[v.name] = vv;
      }
      for (const c of model.constraints) {
        for (const [vname, coef] of Object.entries(c.coeffs)) {
          if (variables[vname]) variables[vname][c.name] = coef;
        }
      }

      const jsModel = {
        optimize: "__cost",
        opType: "min" as const,
        constraints,
        variables,
      };

      const res: any = solver.Solve(jsModel);
      if (!res || res.feasible === false) {
        return { status: "infeasible", objective: null, values: {} };
      }
      const values: Record<string, number> = {};
      for (const v of model.vars) values[v.name] = typeof res[v.name] === "number" ? res[v.name] : 0;
      const objective = typeof res.result === "number" ? res.result : null;
      return { status: "optimal", objective, values };
    },
  };
}
