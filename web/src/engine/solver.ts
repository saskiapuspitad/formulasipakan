// ============================================================================
// solver.ts — Bentuk LP kanonik + antarmuka Solver (agar mesin bebas-solver).
// Aplikasi memakai adapter glpk.js (browser); pengujian memakai adapter lain
// yang mengimplementasi antarmuka yang sama.
// ============================================================================

export type ConstraintType = "eq" | "le" | "ge";

export interface LPVar {
  name: string;
  cost: number;   // koefisien fungsi objektif (minimisasi)
}

export interface LPBound {
  name: string;
  lb: number;
  ub: number;
}

export interface LPConstraint {
  name: string;
  coeffs: Record<string, number>;
  type: ConstraintType;
  rhs: number;
}

/** Model LP kanonik: minimalkan Σ cost·x, tunduk pada constraints & bounds. */
export interface LPModel {
  name: string;
  vars: LPVar[];
  bounds: LPBound[];
  constraints: LPConstraint[];
}

export type SolverStatus = "optimal" | "infeasible" | "unbounded" | "error";

export interface SolverResult {
  status: SolverStatus;
  objective: number | null;
  values: Record<string, number>;
  message?: string;
}

/** Antarmuka yang harus dipenuhi setiap adapter solver. */
export interface Solver {
  solve(model: LPModel): Promise<SolverResult>;
}
