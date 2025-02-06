import path from 'node:path';
import fs from 'node:fs';
import { execSync } from 'child_process';
import Electron from 'electron';
import log from './logger';

export const getBinaryPath = (app: Electron.App, binaryName: string): string => {
  const isDev = process.env.NODE_ENV === 'development';
  const isPackaged = app.isPackaged;
  const isWindows = process.platform === 'win32';

  // For Windows, we need to handle different executable types
  let executableName;
  if (isWindows) {
    switch (binaryName) {
      case 'uvx':
      case 'npx':
        executableName = `${binaryName}.bat`;
        break;
      default:
        executableName = `${binaryName}.exe`;
    }
  } else {
    executableName = binaryName;
  }

  // List of possible paths to check
  const possiblePaths = [];

  if (isDev && !isPackaged) {
    // In development, check multiple possible locations
    possiblePaths.push(
      path.join(process.cwd(), 'src', 'bin', executableName),
      path.join(process.cwd(), 'bin', executableName),
      path.join(process.cwd(), '..', '..', 'target', 'release', executableName)
    );

    // For Windows dev environment, also check npm global paths
    if (isWindows && (binaryName === 'uvx' || binaryName === 'npx')) {
      try {
        const npmBin = execSync('npm bin -g').toString().trim();
        possiblePaths.push(
          path.join(npmBin, `${binaryName}.cmd`),
          path.join(process.env.APPDATA, 'npm', `${binaryName}.cmd`)
        );
      } catch (error) {
        log.error('Error getting npm bin path:', error);
      }
    }
  } else {
    // In production, check resources paths
    possiblePaths.push(
      path.join(process.resourcesPath, 'bin', executableName),
      path.join(app.getAppPath(), 'resources', 'bin', executableName)
    );
  }

  // Log all paths we're checking
  log.info('Checking binary paths:', possiblePaths);

  // Try each path and return the first one that exists
  for (const binPath of possiblePaths) {
    try {
      if (fs.existsSync(binPath)) {
        log.info(`Found binary at: ${binPath}`);
        return binPath;
      }
    } catch (error) {
      log.error(`Error checking path ${binPath}:`, error);
    }
  }

  // If we get here, we couldn't find the binary
  const error = `Could not find ${binaryName} binary in any of the expected locations: ${possiblePaths.join(', ')}`;
  log.error(error);
  throw new Error(error);
};
