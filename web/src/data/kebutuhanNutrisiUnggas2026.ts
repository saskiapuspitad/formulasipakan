// ============================================================================
// DIBUAT OTOMATIS oleh tools/buat_kebutuhan_ts.py — jangan diedit manual.
// Sumber: tools/Kebutuhan_Nutrisi_Unggas_normalized.xlsx, sheet "kebutuhan_normalized"
// (23 baris). Data tampilan menu Kebutuhan Nutrisi, apa adanya dari berkas.
// ============================================================================

export type ParamKebutuhan = "EM" | "PK" | "LK" | "SK" | "Ca" | "P" | "Lisin" | "Methionin";

export interface BarisKebutuhan {
  ternak: string;
  periode: string;
  nilai: Record<ParamKebutuhan, { min: number | null; maks: number | null }>;
}

export const SUMBER_KEBUTUHAN = "Kebutuhan Nutrisi Ternak Unggas 2026 (Kebutuhan Nutrisi Unggas Indonesia)";

export const KEBUTUHAN_NUTRISI_2026: BarisKebutuhan[] = [
  {
    "ternak": "Ayam Pedaging (Broiler)",
    "periode": "Ayam Pedaging Periode Pre-Starter",
    "nilai": {
      "EM": {
        "min": 2950.0,
        "maks": null
      },
      "PK": {
        "min": 22.5,
        "maks": null
      },
      "LK": {
        "min": 5.0,
        "maks": 8.0
      },
      "SK": {
        "min": 3.0,
        "maks": 5.0
      },
      "Ca": {
        "min": 0.9,
        "maks": 1.1
      },
      "P": {
        "min": 0.7,
        "maks": 0.9
      },
      "Lisin": {
        "min": 1.1,
        "maks": null
      },
      "Methionin": {
        "min": 0.5,
        "maks": null
      }
    }
  },
  {
    "ternak": "Ayam Pedaging (Broiler)",
    "periode": "Ayam Pedaging Periode Starter",
    "nilai": {
      "EM": {
        "min": 3050.0,
        "maks": null
      },
      "PK": {
        "min": 21.5,
        "maks": null
      },
      "LK": {
        "min": 5.0,
        "maks": 8.0
      },
      "SK": {
        "min": 3.0,
        "maks": 5.0
      },
      "Ca": {
        "min": 0.9,
        "maks": 1.1
      },
      "P": {
        "min": 0.7,
        "maks": 0.9
      },
      "Lisin": {
        "min": 1.1,
        "maks": null
      },
      "Methionin": {
        "min": 0.5,
        "maks": null
      }
    }
  },
  {
    "ternak": "Ayam Pedaging (Broiler)",
    "periode": "Ayam Pedaging Periode Finisher",
    "nilai": {
      "EM": {
        "min": 3100.0,
        "maks": null
      },
      "PK": {
        "min": 20.0,
        "maks": null
      },
      "LK": {
        "min": 5.0,
        "maks": 8.0
      },
      "SK": {
        "min": 3.0,
        "maks": 5.0
      },
      "Ca": {
        "min": 0.9,
        "maks": 1.1
      },
      "P": {
        "min": 0.7,
        "maks": 0.9
      },
      "Lisin": {
        "min": 1.0,
        "maks": null
      },
      "Methionin": {
        "min": 0.38,
        "maks": null
      }
    }
  },
  {
    "ternak": "Ayam Petelur (Layer)",
    "periode": "Ayam Petelur Periode Starter",
    "nilai": {
      "EM": {
        "min": 2800.0,
        "maks": null
      },
      "PK": {
        "min": 19.0,
        "maks": null
      },
      "LK": {
        "min": 4.0,
        "maks": 6.0
      },
      "SK": {
        "min": 4.0,
        "maks": 5.0
      },
      "Ca": {
        "min": 0.9,
        "maks": 1.1
      },
      "P": {
        "min": 0.6,
        "maks": 0.8
      },
      "Lisin": {
        "min": 0.85,
        "maks": null
      },
      "Methionin": {
        "min": 0.3,
        "maks": null
      }
    }
  },
  {
    "ternak": "Ayam Petelur (Layer)",
    "periode": "Ayam Petelur Periode Grower",
    "nilai": {
      "EM": {
        "min": 2600.0,
        "maks": null
      },
      "PK": {
        "min": 16.0,
        "maks": null
      },
      "LK": {
        "min": 4.0,
        "maks": 6.0
      },
      "SK": {
        "min": 5.0,
        "maks": 6.0
      },
      "Ca": {
        "min": 0.9,
        "maks": 1.1
      },
      "P": {
        "min": 0.6,
        "maks": 0.8
      },
      "Lisin": {
        "min": 0.6,
        "maks": null
      },
      "Methionin": {
        "min": 0.25,
        "maks": null
      }
    }
  },
  {
    "ternak": "Ayam Petelur (Layer)",
    "periode": "Ayam Petelur Periode Layer 1",
    "nilai": {
      "EM": {
        "min": 2650.0,
        "maks": null
      },
      "PK": {
        "min": 17.0,
        "maks": null
      },
      "LK": {
        "min": 4.0,
        "maks": 6.0
      },
      "SK": {
        "min": 4.0,
        "maks": 6.0
      },
      "Ca": {
        "min": 3.3,
        "maks": 3.8
      },
      "P": {
        "min": 0.7,
        "maks": 0.9
      },
      "Lisin": {
        "min": 0.73,
        "maks": null
      },
      "Methionin": {
        "min": 0.34,
        "maks": null
      }
    }
  },
  {
    "ternak": "Ayam Petelur (Layer)",
    "periode": "Ayam Petelur Periode layer 2",
    "nilai": {
      "EM": {
        "min": 2650.0,
        "maks": null
      },
      "PK": {
        "min": 16.5,
        "maks": null
      },
      "LK": {
        "min": 4.0,
        "maks": 6.0
      },
      "SK": {
        "min": 4.0,
        "maks": 6.0
      },
      "Ca": {
        "min": 3.5,
        "maks": 3.8
      },
      "P": {
        "min": 0.7,
        "maks": 0.9
      },
      "Lisin": {
        "min": 0.6,
        "maks": null
      },
      "Methionin": {
        "min": 0.25,
        "maks": null
      }
    }
  },
  {
    "ternak": "Kalkun",
    "periode": "Kalkun Periode Starter 1",
    "nilai": {
      "EM": {
        "min": 2800.0,
        "maks": null
      },
      "PK": {
        "min": 28.0,
        "maks": null
      },
      "LK": {
        "min": 5.0,
        "maks": 8.0
      },
      "SK": {
        "min": 3.0,
        "maks": 5.0
      },
      "Ca": {
        "min": 1.2,
        "maks": null
      },
      "P": {
        "min": 0.6,
        "maks": null
      },
      "Lisin": {
        "min": 1.6,
        "maks": null
      },
      "Methionin": {
        "min": 0.55,
        "maks": null
      }
    }
  },
  {
    "ternak": "Kalkun",
    "periode": "Kalkun Periode Starter 2",
    "nilai": {
      "EM": {
        "min": 2900.0,
        "maks": null
      },
      "PK": {
        "min": 26.0,
        "maks": null
      },
      "LK": {
        "min": 5.0,
        "maks": 8.0
      },
      "SK": {
        "min": 3.0,
        "maks": 5.0
      },
      "Ca": {
        "min": 1.0,
        "maks": null
      },
      "P": {
        "min": 0.5,
        "maks": null
      },
      "Lisin": {
        "min": 1.5,
        "maks": null
      },
      "Methionin": {
        "min": 0.45,
        "maks": null
      }
    }
  },
  {
    "ternak": "Kalkun",
    "periode": "Kalkun Periode Grower 1",
    "nilai": {
      "EM": {
        "min": 3000.0,
        "maks": null
      },
      "PK": {
        "min": 22.0,
        "maks": null
      },
      "LK": {
        "min": 5.0,
        "maks": 8.0
      },
      "SK": {
        "min": 3.0,
        "maks": 5.0
      },
      "Ca": {
        "min": 0.85,
        "maks": null
      },
      "P": {
        "min": 0.42,
        "maks": null
      },
      "Lisin": {
        "min": 1.3,
        "maks": null
      },
      "Methionin": {
        "min": 0.4,
        "maks": null
      }
    }
  },
  {
    "ternak": "Kalkun",
    "periode": "Kalkun Periode Grower 2",
    "nilai": {
      "EM": {
        "min": 3100.0,
        "maks": null
      },
      "PK": {
        "min": 19.0,
        "maks": null
      },
      "LK": {
        "min": 5.0,
        "maks": 8.0
      },
      "SK": {
        "min": 3.0,
        "maks": 5.0
      },
      "Ca": {
        "min": 0.75,
        "maks": null
      },
      "P": {
        "min": 0.38,
        "maks": null
      },
      "Lisin": {
        "min": 1.0,
        "maks": null
      },
      "Methionin": {
        "min": 0.35,
        "maks": null
      }
    }
  },
  {
    "ternak": "Kalkun",
    "periode": "Kalkun Periode Finisher 1",
    "nilai": {
      "EM": {
        "min": 3200.0,
        "maks": null
      },
      "PK": {
        "min": 16.5,
        "maks": null
      },
      "LK": {
        "min": 5.0,
        "maks": 8.0
      },
      "SK": {
        "min": 3.0,
        "maks": 5.0
      },
      "Ca": {
        "min": 0.65,
        "maks": null
      },
      "P": {
        "min": 0.32,
        "maks": null
      },
      "Lisin": {
        "min": 0.8,
        "maks": null
      },
      "Methionin": {
        "min": 0.25,
        "maks": null
      }
    }
  },
  {
    "ternak": "Kalkun",
    "periode": "Kalkun Periode Finisher 2",
    "nilai": {
      "EM": {
        "min": 3300.0,
        "maks": null
      },
      "PK": {
        "min": 14.0,
        "maks": null
      },
      "LK": {
        "min": 5.0,
        "maks": 8.0
      },
      "SK": {
        "min": 3.0,
        "maks": 5.0
      },
      "Ca": {
        "min": 0.55,
        "maks": null
      },
      "P": {
        "min": 0.28,
        "maks": null
      },
      "Lisin": {
        "min": 0.65,
        "maks": null
      },
      "Methionin": {
        "min": 0.25,
        "maks": null
      }
    }
  },
  {
    "ternak": "Kalkun",
    "periode": "Kalkun Periode Layer",
    "nilai": {
      "EM": {
        "min": 2900.0,
        "maks": null
      },
      "PK": {
        "min": 14.0,
        "maks": null
      },
      "LK": {
        "min": 4.0,
        "maks": 6.0
      },
      "SK": {
        "min": 4.0,
        "maks": 6.0
      },
      "Ca": {
        "min": 2.25,
        "maks": null
      },
      "P": {
        "min": 0.35,
        "maks": null
      },
      "Lisin": {
        "min": 0.6,
        "maks": null
      },
      "Methionin": {
        "min": 0.2,
        "maks": null
      }
    }
  },
  {
    "ternak": "Itik",
    "periode": "Itik Periode Starter",
    "nilai": {
      "EM": {
        "min": 2900.0,
        "maks": null
      },
      "PK": {
        "min": 22.0,
        "maks": null
      },
      "LK": {
        "min": 5.0,
        "maks": 8.0
      },
      "SK": {
        "min": 3.0,
        "maks": 5.0
      },
      "Ca": {
        "min": 0.65,
        "maks": null
      },
      "P": {
        "min": 0.4,
        "maks": null
      },
      "Lisin": {
        "min": 0.9,
        "maks": null
      },
      "Methionin": {
        "min": 0.4,
        "maks": null
      }
    }
  },
  {
    "ternak": "Itik",
    "periode": "Itik  Periode Grower",
    "nilai": {
      "EM": {
        "min": 3000.0,
        "maks": null
      },
      "PK": {
        "min": 16.0,
        "maks": null
      },
      "LK": {
        "min": 5.0,
        "maks": 8.0
      },
      "SK": {
        "min": 3.0,
        "maks": 5.0
      },
      "Ca": {
        "min": 0.6,
        "maks": null
      },
      "P": {
        "min": 0.3,
        "maks": null
      },
      "Lisin": {
        "min": 0.65,
        "maks": null
      },
      "Methionin": {
        "min": 0.3,
        "maks": null
      }
    }
  },
  {
    "ternak": "Itik",
    "periode": "Itik Periode Layer",
    "nilai": {
      "EM": {
        "min": 2850.0,
        "maks": null
      },
      "PK": {
        "min": 15.0,
        "maks": null
      },
      "LK": {
        "min": 4.0,
        "maks": 6.0
      },
      "SK": {
        "min": 4.0,
        "maks": 6.0
      },
      "Ca": {
        "min": 2.75,
        "maks": null
      },
      "P": {
        "min": 0.4,
        "maks": null
      },
      "Lisin": {
        "min": 0.6,
        "maks": null
      },
      "Methionin": {
        "min": 0.27,
        "maks": null
      }
    }
  },
  {
    "ternak": "Puyuh",
    "periode": "Puyuh Periode Starter",
    "nilai": {
      "EM": {
        "min": 2900.0,
        "maks": null
      },
      "PK": {
        "min": 24.0,
        "maks": null
      },
      "LK": {
        "min": 5.0,
        "maks": 8.0
      },
      "SK": {
        "min": 3.0,
        "maks": 5.0
      },
      "Ca": {
        "min": 0.8,
        "maks": null
      },
      "P": {
        "min": 0.3,
        "maks": null
      },
      "Lisin": {
        "min": 1.3,
        "maks": null
      },
      "Methionin": {
        "min": 0.5,
        "maks": null
      }
    }
  },
  {
    "ternak": "Puyuh",
    "periode": "Puyuh Periode Layer",
    "nilai": {
      "EM": {
        "min": 2900.0,
        "maks": null
      },
      "PK": {
        "min": 20.0,
        "maks": null
      },
      "LK": {
        "min": 4.0,
        "maks": 6.0
      },
      "SK": {
        "min": 4.0,
        "maks": 6.0
      },
      "Ca": {
        "min": 2.75,
        "maks": null
      },
      "P": {
        "min": 0.35,
        "maks": null
      },
      "Lisin": {
        "min": 1.0,
        "maks": null
      },
      "Methionin": {
        "min": 0.45,
        "maks": null
      }
    }
  },
  {
    "ternak": "Ayam Kampung",
    "periode": "Ayam Kampung Starter",
    "nilai": {
      "EM": {
        "min": 2900.0,
        "maks": null
      },
      "PK": {
        "min": 19.0,
        "maks": null
      },
      "LK": {
        "min": 4.0,
        "maks": 6.0
      },
      "SK": {
        "min": 5.0,
        "maks": 7.0
      },
      "Ca": {
        "min": 0.9,
        "maks": 1.1
      },
      "P": {
        "min": 0.7,
        "maks": 0.9
      },
      "Lisin": {
        "min": 1.0,
        "maks": null
      },
      "Methionin": {
        "min": 0.45,
        "maks": null
      }
    }
  },
  {
    "ternak": "Ayam Kampung",
    "periode": "Ayam Kampung Grower",
    "nilai": {
      "EM": {
        "min": 2500.0,
        "maks": null
      },
      "PK": {
        "min": 14.0,
        "maks": null
      },
      "LK": {
        "min": 4.0,
        "maks": 7.0
      },
      "SK": {
        "min": 3.0,
        "maks": 6.0
      },
      "Ca": {
        "min": 0.9,
        "maks": 1.1
      },
      "P": {
        "min": 0.7,
        "maks": 0.9
      },
      "Lisin": {
        "min": 1.0,
        "maks": null
      },
      "Methionin": {
        "min": 0.45,
        "maks": null
      }
    }
  },
  {
    "ternak": "Ayam Kampung",
    "periode": "Ayam Kampung Layer",
    "nilai": {
      "EM": {
        "min": 2500.0,
        "maks": null
      },
      "PK": {
        "min": 16.0,
        "maks": null
      },
      "LK": {
        "min": 4.0,
        "maks": 7.0
      },
      "SK": {
        "min": 3.0,
        "maks": 6.0
      },
      "Ca": {
        "min": 2.75,
        "maks": 3.0
      },
      "P": {
        "min": 0.7,
        "maks": 0.9
      },
      "Lisin": {
        "min": 1.0,
        "maks": null
      },
      "Methionin": {
        "min": 0.45,
        "maks": null
      }
    }
  },
  {
    "ternak": "Ayam KUB",
    "periode": "Ayam KUB Layer",
    "nilai": {
      "EM": {
        "min": 2800.0,
        "maks": null
      },
      "PK": {
        "min": 17.5,
        "maks": null
      },
      "LK": {
        "min": 4.0,
        "maks": 7.0
      },
      "SK": {
        "min": 3.0,
        "maks": 6.0
      },
      "Ca": {
        "min": 2.75,
        "maks": 3.0
      },
      "P": {
        "min": 0.7,
        "maks": 0.9
      },
      "Lisin": {
        "min": 1.0,
        "maks": null
      },
      "Methionin": {
        "min": 0.45,
        "maks": null
      }
    }
  }
];
