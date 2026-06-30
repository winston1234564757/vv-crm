import fs from 'fs';
import path from 'path';

const inventoryPath = path.join(process.cwd(), 'src/lib/actions/inventory.ts');
const devicesPath = path.join(process.cwd(), 'src/lib/actions/devices.ts');
const accessoriesPath = path.join(process.cwd(), 'src/lib/actions/accessories.ts');
const servicesPath = path.join(process.cwd(), 'src/lib/actions/services.ts');

const content = fs.readFileSync(inventoryPath, 'utf8');

// The common imports header
const commonImports = `"use server";
import { requireRole } from "@/lib/utils/rbac";
import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { parseError } from "@/lib/utils/errors";
import type { ActionState } from "./types";
import type { Database } from "@/types/database";
import { SupabaseClient } from "@supabase/supabase-js";
import { uploadMediaFiles } from "@/lib/supabase/storage";

type DeviceUpdate = Database["public"]["Tables"]["devices"]["Update"];
type AccessoryInsert = Database["public"]["Tables"]["accessories"]["Insert"];
type AccessoryUpdate = Database["public"]["Tables"]["accessories"]["Update"];
type ServiceInsert = Database["public"]["Tables"]["services"]["Insert"];
type ServiceUpdate = Database["public"]["Tables"]["services"]["Update"];
`;

// Simple extraction based on known keywords
const deviceRegex = /const deviceSchema = [\s\S]*?(?=const accessorySchema =)/;
const accessoryRegex = /const accessorySchema = [\s\S]*?(?=const serviceSchema =)/;
const serviceRegex = /const serviceSchema = [\s\S]*?(?=export async function updateDeviceStatus)/;
const devicePart2Regex = /export async function updateDeviceStatus[\s\S]*$/;

const deviceMatch = content.match(deviceRegex);
const accessoryMatch = content.match(accessoryRegex);
const serviceMatch = content.match(serviceRegex);
const devicePart2Match = content.match(devicePart2Regex);

if (deviceMatch && accessoryMatch && serviceMatch && devicePart2Match) {
  const devicesContent = commonImports + '\n\n' + deviceMatch[0] + '\n\n' + devicePart2Match[0];
  const accessoriesContent = commonImports + '\n\n' + accessoryMatch[0];
  
  // Clean up duplicate import in services
  let sContent = serviceMatch[0].replace(/import { uploadMediaFiles } from "@\/lib\/supabase\/storage";\n/g, '');
  const servicesContent = commonImports + '\n\n' + sContent;

  fs.writeFileSync(devicesPath, devicesContent);
  fs.writeFileSync(accessoriesPath, accessoriesContent);
  fs.writeFileSync(servicesPath, servicesContent);

  // Replace inventory.ts with barrel exports
  const barrelContent = `"use server";\n\nexport * from "./devices";\nexport * from "./accessories";\nexport * from "./services";\n`;
  fs.writeFileSync(inventoryPath, barrelContent);
  
  console.log("Successfully split inventory.ts into devices.ts, accessories.ts, and services.ts");
} else {
  console.error("Failed to match sections.");
  console.log("Device:", !!deviceMatch);
  console.log("Accessory:", !!accessoryMatch);
  console.log("Service:", !!serviceMatch);
  console.log("Device Part 2:", !!devicePart2Match);
}
