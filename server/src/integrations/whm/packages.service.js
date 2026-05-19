const whmClient = require('./whm.client');
const logger = require('../../middleware/logger');
const db = require('../../config/db');

class PackagesService {
  async listPackages() {
    try {
      logger.info('[WHM] Listing all packages');

      const response = await whmClient.get('/json-api/listpkgs');
      const result = await whmClient.parseResponse(response);

      const packages = result.data?.pkg || [];

      await this.syncPackagesToDatabase(packages);

      logger.info(`[WHM] Retrieved ${packages.length} packages`);
      return packages;
    } catch (error) {
      logger.error('[WHM] List packages failed', { error: error.message });
      throw error;
    }
  }

  async createPackage({
    name,
    featurelist = 'default',
    maxaddon = 0,
    maxpark = 0,
    maxsql = 0,
    maxpop = 0,
    maxemail = 0,
    maxlist = 0,
    maxforwarders = 0,
    diskspace = '100',
    bandwidth = 'unlimited',
  }) {
    try {
      logger.info(`[WHM] Creating package: ${name}`);

      const params = {
        pkgname: name,
        featurelist,
        maxaddon: maxaddon.toString(),
        maxpark: maxpark.toString(),
        maxsql: maxsql.toString(),
        maxpop: maxpop.toString(),
        maxemail: maxemail.toString(),
        maxlist: maxlist.toString(),
        maxforwarders: maxforwarders.toString(),
        diskspace,
        bwlimit: bandwidth,
        hasshell: '0',
      };

      const response = await whmClient.post('/json-api/add-pkg', params);
      const result = await whmClient.parseResponse(response);

      await db.query(
        `INSERT INTO hosting_packages (name, feature_list, max_addon, max_park, max_sql, max_pop, max_email, max_list, max_forwarders, disk_space, bandwidth, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [name, featurelist, maxaddon, maxpark, maxsql, maxpop, maxemail, maxlist, maxforwarders, diskspace, bandwidth]
      );

      logger.info(`[WHM] Package created: ${name}`);
      return result;
    } catch (error) {
      logger.error('[WHM] Create package failed', { name, error: error.message });
      throw error;
    }
  }

  async editPackage(name, updates) {
    try {
      logger.info(`[WHM] Editing package: ${name}`);

      const params = {
        pkgname: name,
        ...updates,
      };

      const response = await whmClient.post('/json-api/edit-pkg', params);
      const result = await whmClient.parseResponse(response);

      await db.query(
        `UPDATE hosting_packages 
         SET feature_list = ?, max_addon = ?, max_park = ?, max_sql = ?, max_pop = ?, max_email = ?, max_list = ?, max_forwarders = ?, disk_space = ?, bandwidth = ?, updated_at = NOW()
         WHERE name = ?`,
        [
          updates.featurelist || null,
          updates.maxaddon || null,
          updates.maxpark || null,
          updates.maxsql || null,
          updates.maxpop || null,
          updates.maxemail || null,
          updates.maxlist || null,
          updates.maxforwarders || null,
          updates.diskspace || null,
          updates.bandwidth || null,
          name,
        ]
      );

      logger.info(`[WHM] Package edited: ${name}`);
      return result;
    } catch (error) {
      logger.error('[WHM] Edit package failed', { name, error: error.message });
      throw error;
    }
  }

  async deletePackage(name) {
    try {
      logger.info(`[WHM] Deleting package: ${name}`);

      const response = await whmClient.post('/json-api/delete-pkg', {
        pkg: name,
      });

      const result = await whmClient.parseResponse(response);

      await db.query('UPDATE hosting_packages SET deleted_at = NOW() WHERE name = ?', [name]);

      logger.info(`[WHM] Package deleted: ${name}`);
      return result;
    } catch (error) {
      logger.error('[WHM] Delete package failed', { name, error: error.message });
      throw error;
    }
  }

  async getPackageDetails(name) {
    try {
      logger.info(`[WHM] Getting package details: ${name}`);

      const packages = await this.listPackages();
      const pkg = packages.find((p) => p.name === name);

      if (!pkg) {
        throw new Error(`Package not found: ${name}`);
      }

      return pkg;
    } catch (error) {
      logger.error('[WHM] Get package details failed', { name, error: error.message });
      throw error;
    }
  }

  async syncPackagesToDatabase(packages) {
    try {
      for (const pkg of packages) {
        const [existing] = await db.query(
          'SELECT id FROM hosting_packages WHERE name = ?',
          [pkg.name]
        );

        const data = [
          pkg.name,
          pkg.featurelist || 'default',
          pkg.maxaddon || 0,
          pkg.maxpark || 0,
          pkg.maxsql || 0,
          pkg.maxpop || 0,
          pkg.maxemail || 0,
          pkg.maxlist || 0,
          pkg.maxforwarders || 0,
          pkg.diskspace || '0',
          pkg.bwlimit || 'unlimited',
        ];

        if (existing && existing.length > 0) {
          await db.query(
            `UPDATE hosting_packages 
             SET feature_list = ?, max_addon = ?, max_park = ?, max_sql = ?, max_pop = ?, max_email = ?, max_list = ?, max_forwarders = ?, disk_space = ?, bandwidth = ?, updated_at = NOW()
             WHERE name = ?`,
            [...data, pkg.name]
          );
        } else {
          await db.query(
            `INSERT INTO hosting_packages (name, feature_list, max_addon, max_park, max_sql, max_pop, max_email, max_list, max_forwarders, disk_space, bandwidth, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
            data
          );
        }
      }
    } catch (error) {
      logger.error('[Database] Sync packages failed', { error: error.message });
    }
  }
}

module.exports = new PackagesService();
