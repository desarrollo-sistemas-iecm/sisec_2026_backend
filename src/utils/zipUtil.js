import { execFile } from 'child_process'
import path from 'path'
import fs from 'fs/promises'

/**
 * Comprime una carpeta completa de manera ultra-rápida y eficiente en Windows
 * utilizando el ensamblado nativo System.IO.Compression.FileSystem de .NET
 */
export const zipFolder = async (sourceDir, outputZipPath) => {
  const absSource = path.resolve(sourceDir)
  const absOutput = path.resolve(outputZipPath)

  // Eliminar zip previo si existe
  try {
    await fs.unlink(absOutput)
  } catch (e) {
    // ignore
  }

  return new Promise((resolve, reject) => {
    const psCommand = `$ProgressPreference = 'SilentlyContinue'; Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::CreateFromDirectory('${absSource.replace(/'/g, "''")}', '${absOutput.replace(/'/g, "''")}')`

    execFile('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', psCommand], (error, stdout, stderr) => {
      if (error) {
        return reject(new Error(stderr || error.message))
      }
      resolve(absOutput)
    })
  })
}
