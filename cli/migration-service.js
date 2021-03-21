import knex from '../database/connection';
import fs from 'fs';
import path from 'path';

import { Utils } from './utils';

// TODO: Change operation returns to proper returns.
// TODO: Implement config.
export class MigrationService {

  /**
   * Creates a migration file for the given module with the given migration filename.
   *
   * @param {string} moduleName
   * @param {string} migrationName
   */
  static create(moduleName, migrationName) {
    if(!moduleName)
      throw new Error('Module name is not given');

    Utils.validateModule(moduleName);
    return knex.migrate.make(migrationName, Utils.get(moduleName));
  }

  /**
   * Lists the migrations files of a given module.
   *
   * @param {string} moduleName
   */
  static list(moduleName) {
    if(!moduleName)
      throw new Error('Module name is not given');

    const directory = Utils.getMigrationsDirectory(moduleName);
    if(!fs.existsSync(directory))
      throw new Error(`Directory of '${moduleName}' is not existing`);

    return fs.readdirSync(directory);
  }

  /**
   * Migrates a given module, if provided.
   * If not, migrates all modules.
   *
   * @param {string} [moduleName]
   */
  static migrate(moduleName) {
    return MigrationService._migrateMany({ moduleName });
  }

  /**
   * Rollbacks a given module, if provided.
   * If not, migrates all modules.
   *
   * @param {string} [moduleName]
   */
  static async rollback(moduleName) {
    return MigrationService._migrateMany({ moduleName, doMigrate: false });
  }

  /**
   * Migrates up a given module or specific migration file.
   *
   * @param {string} moduleName
   * @param {string} migrationName
   */
  static async up(moduleName, migrationName) {
    if(!moduleName)
      throw new Error('Module name is not given');

    if(!migrationName)
      return MigrationService._migrateOne({ moduleName });

    Utils.validateModule(moduleName);

    let migrationFiles = MigrationService.list(moduleName);
    migrationFiles = migrationFiles.sort((a, b) => a.localeCompare(b));

    const migrationResults = [];
    for(const migrationFile of migrationFiles) {
      migrationResults.push(await MigrationService._migrateOne({ moduleName, migrationFile }));
      if(migrationFile === migrationName)
        break;
    }

    return migrationResults;
  }

  /**
   * Migrates down a given module or specific migration file.
   *
   * @param {string} moduleName
   * @param {string} migrationName
   */
  static async down(moduleName, migrationName) {

    if(!moduleName)
      throw new Error('Module name is not given');

    Utils.validateModule(moduleName);

    let migrationFiles = MigrationService.list(moduleName);
    let [migratedFiles] = await knex.migrate.list(Utils.get(moduleName));
    migrationFiles = migrationFiles
      .filter(file => migratedFiles.includes(file))
      .reverse();

    if(migrationFiles.length === 0)
      throw new Error('No files to migrate down');

    if(!migrationName)
      return MigrationService._migrateOne({
        moduleName, migrationFile: migrationFiles[0], doUp: false,
      });

    const migrationResults = [];
    for(const migrationFile of migrationFiles) {

      if(migrationFile === migrationName)
        break;

      migrationResults.push(await MigrationService._migrateOne({
        moduleName, migrationFile, doUp: false
      }));
    }

    return migrationResults;
  }

  /**
   * Migrates or rollbacks the given module.
   *
   * @private
   * @param {{
   *  moduleName: string,
   *  doMigrate: boolean,
   * }}
   */
  static _migrateMany({ moduleName, doMigrate = true }) {
    if(moduleName)
      Utils.validateModule(moduleName);

    return doMigrate
      ? knex.migrate.latest(Utils.get(moduleName))
      : knex.migrate.rollback(Utils.get(moduleName), true);
  }

  /**
   * Migrates up or down a given module or specific migration file.
   *
   * @private
   * @param {{
   *  moduleName: string,
   *  migrationFile: string,
   *  doUp: boolean,
   * }}
   */
  static _migrateOne({ moduleName, migrationFile, doUp = true }) {
    const config = Utils.get(moduleName);

    if(migrationFile) {
      migrationFile = migrationFile.includes('.js') ? migrationFile : `${migrationFile}.js`;

      if(!fs.existsSync(path.join(config.directory, migrationFile)))
        throw new Error(`${migrationFile} is not existing`);

      config.name = migrationFile;
    }

    return doUp
      ? knex.migrate.up(config)
      : knex.migrate.down(config);
  }
};