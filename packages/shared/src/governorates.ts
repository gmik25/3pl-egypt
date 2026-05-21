// EG: 27 Egyptian governorates, ISO 3166-2:EG codes.
// Used for delivery zone logic, address validation, and governorate-scoped RBAC.

export interface Governorate {
  /** ISO 3166-2:EG subdivision code (e.g. "C" for Cairo). */
  code: GovernorateCode;
  /** English name. */
  nameEn: string;
  /** Arabic name. */
  nameAr: string;
}

export const GOVERNORATES = [
  { code: 'ALX', nameEn: 'Alexandria',     nameAr: 'الإسكندرية'   },
  { code: 'ASN', nameEn: 'Aswan',          nameAr: 'أسوان'         },
  { code: 'AST', nameEn: 'Asyut',          nameAr: 'أسيوط'         },
  { code: 'BH',  nameEn: 'Beheira',        nameAr: 'البحيرة'       },
  { code: 'BNS', nameEn: 'Beni Suef',      nameAr: 'بني سويف'      },
  { code: 'C',   nameEn: 'Cairo',          nameAr: 'القاهرة'       },
  { code: 'DK',  nameEn: 'Dakahlia',       nameAr: 'الدقهلية'      },
  { code: 'DT',  nameEn: 'Damietta',       nameAr: 'دمياط'         },
  { code: 'FYM', nameEn: 'Faiyum',         nameAr: 'الفيوم'        },
  { code: 'GH',  nameEn: 'Gharbia',        nameAr: 'الغربية'       },
  { code: 'GZ',  nameEn: 'Giza',           nameAr: 'الجيزة'        },
  { code: 'IS',  nameEn: 'Ismailia',       nameAr: 'الإسماعيلية'  },
  { code: 'KB',  nameEn: 'Qalyubia',       nameAr: 'القليوبية'     },
  { code: 'KFS', nameEn: 'Kafr el-Sheikh', nameAr: 'كفر الشيخ'     },
  { code: 'KN',  nameEn: 'Qena',           nameAr: 'قنا'           },
  { code: 'LX',  nameEn: 'Luxor',          nameAr: 'الأقصر'        },
  { code: 'MN',  nameEn: 'Minya',          nameAr: 'المنيا'        },
  { code: 'MNF', nameEn: 'Monufia',        nameAr: 'المنوفية'      },
  { code: 'MT',  nameEn: 'Matruh',         nameAr: 'مطروح'         },
  { code: 'PTS', nameEn: 'Port Said',      nameAr: 'بورسعيد'       },
  { code: 'BA',  nameEn: 'Red Sea',        nameAr: 'البحر الأحمر' },
  { code: 'SHG', nameEn: 'Sohag',          nameAr: 'سوهاج'         },
  { code: 'SHR', nameEn: 'Sharqia',        nameAr: 'الشرقية'       },
  { code: 'SIN', nameEn: 'North Sinai',    nameAr: 'شمال سيناء'    },
  { code: 'JS',  nameEn: 'South Sinai',    nameAr: 'جنوب سيناء'    },
  { code: 'SUZ', nameEn: 'Suez',           nameAr: 'السويس'        },
  { code: 'WAD', nameEn: 'New Valley',     nameAr: 'الوادي الجديد' },
] as const satisfies readonly Governorate[];

export type GovernorateCode =
  | 'ALX' | 'ASN' | 'AST' | 'BH'  | 'BNS' | 'C'   | 'DK'
  | 'DT'  | 'FYM' | 'GH'  | 'GZ'  | 'IS'  | 'KB'  | 'KFS'
  | 'KN'  | 'LX'  | 'MN'  | 'MNF' | 'MT'  | 'PTS' | 'BA'
  | 'SHG' | 'SHR' | 'SIN' | 'JS'  | 'SUZ' | 'WAD';

const BY_CODE: Record<string, Governorate> = Object.fromEntries(
  GOVERNORATES.map((g) => [g.code, g]),
);

export function getGovernorate(code: GovernorateCode): Governorate {
  const g = BY_CODE[code];
  if (!g) throw new Error(`Unknown governorate code: ${code}`);
  return g;
}

export function isGovernorateCode(value: unknown): value is GovernorateCode {
  return typeof value === 'string' && value in BY_CODE;
}

/**
 * Best-effort resolve a free-text province/state string (from a webhook payload, CSV, etc.)
 * to a Governorate, matching the ISO code, English name, or Arabic name (case/space-insensitive).
 * EG: e-commerce platforms send governorate as inconsistent free text — normalise it here.
 */
export function findGovernorate(query: string): Governorate | undefined {
  if (!query) return undefined;
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
  const q = norm(query);
  if (q.toUpperCase() in BY_CODE) return BY_CODE[q.toUpperCase()];
  return GOVERNORATES.find(
    (g) => norm(g.nameEn) === q || g.nameAr.trim() === query.trim() || norm(g.nameEn).includes(q) || q.includes(norm(g.nameEn)),
  );
}
