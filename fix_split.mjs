import fs from 'fs';
import path from 'path';

const servicesPath = path.join(process.cwd(), 'src/lib/actions/services.ts');
const devicesPath = path.join(process.cwd(), 'src/lib/actions/devices.ts');
const accessoriesPath = path.join(process.cwd(), 'src/lib/actions/accessories.ts');

const servicesContent = fs.readFileSync(servicesPath, 'utf8');

// Find the boundaries
const updateDeviceIdx = servicesContent.indexOf('export async function updateDevice(');
const updateAccessoryIdx = servicesContent.indexOf('export async function updateAccessory(');

if (updateDeviceIdx !== -1 && updateAccessoryIdx !== -1) {
  // Extract sections
  const pureServices = servicesContent.substring(0, updateDeviceIdx).trim() + '\n';
  const devicesPart = servicesContent.substring(updateDeviceIdx, updateAccessoryIdx).trim() + '\n';
  const accessoriesPart = servicesContent.substring(updateAccessoryIdx).trim() + '\n';

  // Overwrite services
  fs.writeFileSync(servicesPath, pureServices);

  // Append to devices
  fs.appendFileSync(devicesPath, '\n\n' + devicesPart);

  // Append to accessories
  fs.appendFileSync(accessoriesPath, '\n\n' + accessoriesPart);

  console.log("Successfully fixed the split!");
} else {
  console.log("Could not find the function boundaries.");
}
