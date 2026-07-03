import { put } from '@vercel/blob';
import { readdir, readFile } from 'fs/promises';
import path from 'path';

const localDir = 'C:\\Users\\annish.r\\Desktop\\Invoice Initial Estimation Agent';

const files = await readdir(localDir);
for (const file of files) {
  if (!file.toLowerCase().endsWith('.pdf')) continue;
  const buffer = await readFile(path.join(localDir, file));
  const blob = await put(file, buffer, { access: 'public' });
  console.log(`Uploaded ${file} -> ${blob.url}`);
}