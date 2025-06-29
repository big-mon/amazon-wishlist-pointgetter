#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

const CHROME_WEB_STORE_API = 'https://www.googleapis.com/chromewebstore/v1.1';

class ChromeWebStoreDeployer {
  constructor() {
    this.extensionId = process.env.CHROME_EXTENSION_ID;
    this.clientId = process.env.CHROME_CLIENT_ID;
    this.clientSecret = process.env.CHROME_CLIENT_SECRET;
    this.refreshToken = process.env.CHROME_REFRESH_TOKEN;
    
    if (!this.extensionId || !this.clientId || !this.clientSecret || !this.refreshToken) {
      throw new Error('Missing required environment variables. Please check CHROME_EXTENSION_ID, CHROME_CLIENT_ID, CHROME_CLIENT_SECRET, and CHROME_REFRESH_TOKEN');
    }
  }

  async getAccessToken() {
    const postData = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      refresh_token: this.refreshToken,
      grant_type: 'refresh_token'
    }).toString();

    const options = {
      hostname: 'accounts.google.com',
      path: '/o/oauth2/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    return new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            if (response.access_token) {
              resolve(response.access_token);
            } else {
              reject(new Error(`Failed to get access token: ${data}`));
            }
          } catch (error) {
            reject(error);
          }
        });
      });

      req.on('error', reject);
      req.write(postData);
      req.end();
    });
  }

  async uploadExtension(zipFilePath, accessToken) {
    const zipData = fs.readFileSync(zipFilePath);
    
    const options = {
      hostname: 'www.googleapis.com',
      path: `/upload/chromewebstore/v1.1/items/${this.extensionId}`,
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'x-goog-api-version': '2',
        'Content-Type': 'application/zip',
        'Content-Length': zipData.length
      }
    };

    return new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            if (response.uploadState === 'SUCCESS') {
              resolve(response);
            } else {
              reject(new Error(`Upload failed: ${data}`));
            }
          } catch (error) {
            reject(error);
          }
        });
      });

      req.on('error', reject);
      req.write(zipData);
      req.end();
    });
  }

  async publishExtension(accessToken) {
    const options = {
      hostname: 'www.googleapis.com',
      path: `/chromewebstore/v1.1/items/${this.extensionId}/publish`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'x-goog-api-version': '2',
        'Content-Length': 0
      }
    };

    return new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            if (response.status && response.status.includes('OK')) {
              resolve(response);
            } else {
              reject(new Error(`Publish failed: ${data}`));
            }
          } catch (error) {
            reject(error);
          }
        });
      });

      req.on('error', reject);
      req.end();
    });
  }

  async deploy() {
    try {
      console.log('🚀 Starting Chrome Web Store deployment...');
      
      // Build extension
      console.log('📦 Building extension...');
      execSync('pnpm build', { stdio: 'inherit' });
      
      // Create zip file
      console.log('🗜️  Creating zip file...');
      const zipPath = path.join(__dirname, '..', 'extension.zip');
      execSync(`cd dist && zip -r ${zipPath} .`, { stdio: 'inherit' });
      
      // Get access token
      console.log('🔑 Getting access token...');
      const accessToken = await this.getAccessToken();
      
      // Upload extension
      console.log('⬆️  Uploading extension...');
      await this.uploadExtension(zipPath, accessToken);
      console.log('✅ Upload successful!');
      
      // Publish extension
      console.log('📢 Publishing extension...');
      await this.publishExtension(accessToken);
      console.log('🎉 Extension published successfully!');
      
      // Clean up
      fs.unlinkSync(zipPath);
      
    } catch (error) {
      console.error('❌ Deployment failed:', error.message);
      process.exit(1);
    }
  }
}

if (require.main === module) {
  const deployer = new ChromeWebStoreDeployer();
  deployer.deploy();
}

module.exports = ChromeWebStoreDeployer;