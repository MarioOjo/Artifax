const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');

// The packaged app only needs the Electron entry point, the React production build and the one
// runtime package main.js requires. Everything else in package.json (react-scripts, TypeScript,
// Tailwind, testing libraries...) is build-time only and used to be bundled into the installer.
const PACKAGED_PATHS = ['/package.json', '/main.js', '/build', '/node_modules/electron-squirrel-startup'];

const isPackaged = (filePath) => {
  const normalized = filePath.replace(/\\/g, '/');
  if (normalized === '' || normalized === '/node_modules') return true;
  return PACKAGED_PATHS.some((allowed) => normalized === allowed || normalized.startsWith(`${allowed}/`));
};

module.exports = {
  // Redirects the build output away from OneDrive to prevent EBUSY locks
  outDir: 'C:/ElectronBuilds/Artifax',
  packagerConfig: {
    asar: true,
    buildDebounce: 2000,
    ignore: (filePath) => !isPackaged(filePath),
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {authors: 'I know what you committed last summer', description: 'Artifax, a streamlined and scalable inventory management system designed to efficiently track internal warehouse operations and production across multiple locations.'},
    },
    {
      // Portable Windows build: unzip and run Artifax.exe, nothing to install
      name: '@electron-forge/maker-zip',
      platforms: ['darwin', 'win32'],
    },
    {
      name: '@electron-forge/maker-deb',
      config: {},
    },
    {
      name: '@electron-forge/maker-rpm',
      config: {},
    },
  ],
  plugins: [
    {
      name: '@electron-forge/plugin-auto-unpack-natives',
      config: {},
    },
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};
