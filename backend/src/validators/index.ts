import { z } from "zod";
import { ROLES } from "../types";
import { dateISO, moneyFromInput } from "../utils/pagination";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const createUserSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email(),
  password: z.string().min(8, "Password minimal 8 karakter"),
  role: z.enum(ROLES as [string, ...string[]]),
});

export const updateUserSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  email: z.string().email().optional(),
  password: z.string().min(8).optional(),
  role: z.enum(ROLES as [string, ...string[]]).optional(),
});

export const userStatusSchema = z.object({
  is_active: z.boolean(),
});

export const changePasswordSchema = z
  .object({
    current_password: z.string().min(1),
    new_password: z.string().min(8, "Password baru minimal 8 karakter"),
    confirm_password: z.string().min(8),
  })
  .refine((v) => v.new_password === v.confirm_password, {
    message: "Konfirmasi password tidak cocok",
    path: ["confirm_password"],
  });

export const wakifSchema = z.object({
  name: z.string().min(1).max(200),
  type: z.enum(["individu", "organisasi", "lembaga"]).default("individu"),
  nik: z.string().max(30).nullish(),
  phone: z.string().max(30).nullish(),
  email: z.string().email().nullish(),
  address: z.string().max(500).nullish(),
});

export const wakifUpdateSchema = wakifSchema.partial();

export const transactionSchema = z.object({
  transaction_type: z.enum(["penerimaan", "pengeluaran"]),
  wakif_id: z.coerce.number().int().positive().nullish(),
  category_id: z.coerce.number().int().positive(),
  payment_method: z.enum(["tunai", "transfer", "aset_nonkas", "aset"]).nullish(),
  rekening: z.string().max(100).nullish(),
  amount: moneyFromInput,
  description: z.string().max(1000).nullish(),
  transaction_date: dateISO,
  attachment_url: z.string().url().max(500).nullish(),
});

export const transactionUpdateSchema = transactionSchema.partial();

export const rejectSchema = z.object({
  reason: z.string().min(1, "Alasan penolakan wajib diisi").max(500),
});

export const accountSchema = z.object({
  code: z.string().regex(/^[0-9]-[0-9]{4}$/, "Format kode akun: X-XXXX").max(20),
  name: z.string().min(1).max(200),
  account_type: z.enum(["aset", "liabilitas", "aset_neto", "pendapatan", "beban"]),
  description: z.string().max(500).nullish(),
  parent_id: z.coerce.number().int().positive().nullish(),
});

export const accountUpdateSchema = accountSchema
  .partial()
  .omit({ code: true })
  .extend({ is_active: z.boolean().optional() });

export const categorySchema = z.object({
  name: z.string().min(1).max(200),
  transaction_type: z.enum(["penerimaan", "pengeluaran"]),
  default_account_id: z.coerce.number().int().positive(),
  description: z.string().max(500).nullish(),
});

export const categoryUpdateSchema = categorySchema
  .partial()
  .extend({ is_active: z.boolean().optional() });

export const assetSchema = z.object({
  asset_code: z.string().max(50).nullish(),
  name: z.string().min(1).max(200),
  asset_type: z.enum(["tanah", "bangunan", "uang", "kendaraan", "lainnya"]),
  wakif_id: z.coerce.number().int().positive().nullish(),
  acquisition_date: dateISO,
  acquisition_value: moneyFromInput.optional().default(1),
  acquisition_method: z.enum(["wakaf_tunai", "wakaf_aset", "hibah", "lainnya"]).nullish(),
  location: z.string().max(200).nullish(),
  certificate_number: z.string().max(100).nullish(),
  status: z.enum(["aktif", "tidak_aktif", "dihapus", "dipindahtangkan"]).default("aktif"),
  management_status: z
    .enum(["diurus_sendiri", "dikuasakan", "disewakan", "dijual"])
    .default("diurus_sendiri"),
  notes: z.string().max(2000).nullish(),
});

export const assetUpdateSchema = assetSchema.partial();

export const journalPostSchema = z.object({
  entry_date: dateISO.optional(),
  description: z.string().max(500).nullish(),
});
