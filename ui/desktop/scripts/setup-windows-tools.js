#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Ensure bin directory exists
const binDir = path.join(__dirname, '..', 'src', 'bin');
if (!fs.existsSync(binDir)) {
    fs.mkdirSync(binDir, { recursive: true });
}

try {
    console.log('Creating uvx wrapper...');
    
    // Create a simple uvx script that handles the toml command and mcp-server commands
    const uvxScript = `#!/usr/bin/env node

const { execSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Simple argument parser
const args = process.argv.slice(2);

// Create a temporary directory for npm operations
const getTempDir = () => {
    const tempDir = path.join(os.tmpdir(), 'goose-npm-' + Math.random().toString(36).substring(7));
    fs.mkdirSync(tempDir, { recursive: true });
    return tempDir;
};

// Helper function to run npm install with SSL verification disabled
const npmInstall = (pkg, cwd) => {
    const npmCommand = \`npm install \${pkg} --no-save --registry=https://registry.npmjs.org/ --strict-ssl=false\`;
    console.log('Running npm install command:', npmCommand);
    return execSync(npmCommand, {
        cwd,
        stdio: 'inherit',
        env: {
            ...process.env,
            npm_config_registry: 'https://registry.npmjs.org/',
            npm_config_strict_ssl: 'false'
        }
    });
};

// Helper function to run MCP servers
const runMcpServer = async (serverType) => {
    try {
        // Create temp directory and install the server
        const tempDir = getTempDir();
        fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify({
            name: 'temp',
            version: '1.0.0'
        }));
        
        console.log(\`Installing \${serverType}...\`);
        const packageName = \`@modelcontextprotocol/server-\${serverType.replace('mcp-server-', '')}\`;
        npmInstall(packageName, tempDir);
        
        console.log(\`Starting \${serverType}...\`);
        const serverPath = path.join(tempDir, 'node_modules', packageName, 'dist', 'index.js');
        
        // Log the server path and check if it exists
        console.log('Server path:', serverPath);
        console.log('Server path exists:', fs.existsSync(serverPath));
        console.log('Contents of node_modules:', fs.readdirSync(path.join(tempDir, 'node_modules')));
        
        const child = spawn('node', [serverPath], {
            stdio: 'inherit',
            cwd: tempDir,
            env: {
                ...process.env,
                npm_config_registry: 'https://registry.npmjs.org/',
                npm_config_strict_ssl: 'false'
            }
        });
        
        child.on('error', (error) => {
            console.error(\`Failed to start \${serverType}:\`, error);
            process.exit(1);
        });
        
        // Clean up temp directory when process exits
        process.on('exit', () => {
            try {
                fs.rmSync(tempDir, { recursive: true, force: true });
            } catch (error) {
                console.error('Error cleaning up:', error);
            }
        });
        
        child.on('exit', (code) => {
            process.exit(code);
        });
    } catch (error) {
        console.error(\`Error executing \${serverType}:\`, error);
        process.exit(1);
    }
};

if (args[0] === '--from' && args[1] === 'toml-cli' && args[2] === 'toml') {
    // Handle toml command
    const tomlArgs = args.slice(2);
    try {
        // Create temp directory and install toml-cli
        const tempDir = getTempDir();
        fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify({
            name: 'temp',
            version: '1.0.0'
        }));
        
        npmInstall('toml-cli', tempDir);
        
        const result = execSync('node ' + path.join('node_modules', '.bin', 'toml') + ' ' + tomlArgs.join(' '), {
            cwd: tempDir,
            stdio: 'pipe',
            encoding: 'utf8'
        });
        
        console.log(result.trim());
        fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (error) {
        console.error('Error executing toml command:', error.message);
        process.exit(1);
    }
} else if (args[0].startsWith('mcp-server-')) {
    // Handle any mcp-server command
    runMcpServer(args[0]);
} else {
    console.error('Unsupported uvx command');
    process.exit(1);
}
`;

    // Create the uvx script file
    fs.writeFileSync(path.join(binDir, 'uvx'), uvxScript);
    fs.chmodSync(path.join(binDir, 'uvx'), '755'); // Make executable
    
    // Create uvx.cmd wrapper for Windows
    const uvxCmd = `@ECHO off
SET NODE_NO_WARNINGS=1
SET npm_config_registry=https://registry.npmjs.org/
SET npm_config_strict_ssl=false
node "%~dp0\\uvx" %*`;
    fs.writeFileSync(path.join(binDir, 'uvx.cmd'), uvxCmd);
    
    // Create uvx.bat for Windows
    const uvxBat = `@ECHO off
SET NODE_NO_WARNINGS=1
SET npm_config_registry=https://registry.npmjs.org/
SET npm_config_strict_ssl=false
node "%~dp0\\uvx" %*`;
    fs.writeFileSync(path.join(binDir, 'uvx.bat'), uvxBat);
    
    // Verify files exist
    const files = ['uvx', 'uvx.cmd', 'uvx.bat'];
    const missingFiles = files.filter(file => !fs.existsSync(path.join(binDir, file)));
    
    if (missingFiles.length > 0) {
        throw new Error(`Missing files after setup: ${missingFiles.join(', ')}`);
    }
    
    console.log('Successfully created Windows tools');
    console.log('Files in bin directory:', fs.readdirSync(binDir));
} catch (error) {
    console.error('Error creating Windows tools:', error);
    process.exit(1);
}