@ECHO off
SET NODE_NO_WARNINGS=1
SET npm_config_registry=https://registry.npmjs.org/
SET npm_config_strict_ssl=false
node "%~dp0\uvx" %*