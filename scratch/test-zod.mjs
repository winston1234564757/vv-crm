import { z } from "zod";

const receiptTemplateSchema = z.object({
  title: z.string().min(2, "Заголовок шаблону має містити хоча б 2 символи"),
  show_seller: z.preprocess((val) => val === "true" || val === true, z.boolean()),
  show_buyer: z.preprocess((val) => val === "true" || val === true, z.boolean()),
  warranty_text: z.string().min(2, "Текст гарантії має містити хоча б 2 символи"),
  show_qr: z.preprocess((val) => val === "true" || val === true, z.boolean()),
});

const receiptSettingsSchema = z.object({
  company_name: z.string().min(2, "Назва компанії має містити хоча б 2 символи"),
  company_subtitle: z.string().min(2, "Підзаголовок має містити хоча б 2 символи"),
  address: z.string().min(2, "Адреса має містити хоча б 2 символи"),
  phone: z.string().min(2, "Телефон має містити хоча б 2 символи"),
  footer_text: z.string().min(2, "Текст підвалу має містити хоча б 2 символи"),
  templates: z.object({
    sale: receiptTemplateSchema,
    repair_acceptance: receiptTemplateSchema,
    repair_warranty: receiptTemplateSchema,
  }),
});

// Let's test a sample rawData from form
// We will test several cases to find which one throws "Invalid input"

function runTest(name, data) {
  console.log(`\n--- Running test: ${name} ---`);
  try {
    const parsed = receiptSettingsSchema.parse(data);
    console.log("✅ Validation passed!");
  } catch (err) {
    if (err instanceof z.ZodError) {
      console.log("❌ Validation failed with issues:");
      err.issues.forEach(issue => {
        console.log(`  - Field: "${issue.path.join(".")}", Code: ${issue.code}, Message: "${issue.message}"`);
      });
    } else {
      console.log("❌ Unknown error:", err);
    }
  }
}

// Case 1: All values filled correctly (with booleans as input or "true"/"false" strings)
runTest("Case 1 (Standard correct values)", {
  company_name: "МобіМаркет",
  company_subtitle: "Магазин та сервісний центр",
  address: "м. Березівка, пров. Шевченка 2",
  phone: "+380 967953488",
  footer_text: "Дякуємо за покупку! Чекаємо Вас знову!",
  templates: {
    sale: {
      title: "ТОВАРНИЙ ЧЕК",
      show_seller: true,
      show_buyer: true,
      warranty_text: "Умови гарантії при продажу",
      show_qr: true,
    },
    repair_acceptance: {
      title: "КВИТАНЦІЯ ПРИЙМАННЯ",
      show_seller: true,
      show_buyer: true,
      warranty_text: "Умови приймання на ремонт",
      show_qr: true,
    },
    repair_warranty: {
      title: "ГАРАНТІЙНИЙ ТАЛОН РЕМОНТУ",
      show_seller: true,
      show_buyer: true,
      warranty_text: "Умови гарантії на ремонтні роботи",
      show_qr: true,
    }
  }
});

// Case 2: One of the string fields is null or undefined (e.g. if field is missing from formData)
runTest("Case 2 (Null/undefined title or warranty text)", {
  company_name: "МобіМаркет",
  company_subtitle: "Магазин та сервісний центр",
  address: "м. Березівка, пров. Шевченка 2",
  phone: "+380 967953488",
  footer_text: "Дякуємо за покупку! Чекаємо Вас знову!",
  templates: {
    sale: {
      title: null, // What happens if this is null?
      show_seller: true,
      show_buyer: true,
      warranty_text: "Умови гарантії при продажу",
      show_qr: true,
    },
    repair_acceptance: {
      title: "КВИТАНЦІЯ ПРИЙМАННЯ",
      show_seller: true,
      show_buyer: true,
      warranty_text: undefined, // What happens if this is undefined?
      show_qr: true,
    },
    repair_warranty: {
      title: "ГАРАНТІЙНИЙ ТАЛОН РЕМОНТУ",
      show_seller: true,
      show_buyer: true,
      warranty_text: "Умови гарантії на ремонтні роботи",
      show_qr: true,
    }
  }
});

// Case 3: Boolean fields are undefined
runTest("Case 3 (Boolean fields are undefined/null)", {
  company_name: "МобіМаркет",
  company_subtitle: "Магазин та сервісний центр",
  address: "м. Березівка, пров. Шевченка 2",
  phone: "+380 967953488",
  footer_text: "Дякуємо за покупку! Чекаємо Вас знову!",
  templates: {
    sale: {
      title: "ТОВАРНИЙ ЧЕК",
      show_seller: undefined,
      show_buyer: null,
      warranty_text: "Умови гарантії при продажу",
      show_qr: true,
    },
    repair_acceptance: {
      title: "КВИТАНЦІЯ ПРИЙМАННЯ",
      show_seller: true,
      show_buyer: true,
      warranty_text: "Умови приймання на ремонт",
      show_qr: true,
    },
    repair_warranty: {
      title: "ГАРАНТІЙНИЙ ТАЛОН РЕМОНТУ",
      show_seller: true,
      show_buyer: true,
      warranty_text: "Умови гарантії на ремонтні роботи",
      show_qr: true,
    }
  }
});
