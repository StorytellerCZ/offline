import { check, Match } from 'meteor/check';
const { clear } = Meteor.isClient && require('./idb');

const Archive = Package['jam:archive'];

/**
 * Configuration object for managing data.
 *
 * @property {Object} filter - Filter criteria for data.
 * @property {Object} sort - Sorting options. Default is sorting by `updatedAt` in descending order.
 * @property {number} limit - Maximum number of items to keep. Default is 100.
 * @property {boolean} keepAll - Keep all collections for offline use. Default is `true`.
 * @property {boolean} autoSync - Automatically sync data when coming back online. Default is `true`.
 * @property {Function} handleSyncErrors - Function to handle sync errors.
 * @param {Object} errorParams - Parameters for handling errors.
 * @param {Array} errorParams.replayErrors - List of errors when replaying methods.
 * @param {Array} errorParams.keepErrors - List of errors when determining offline data to keep.
 * @property {Object} [archive] - Archive configuration object (optional).
 * @property {string} archive.name - The name of the archive collection (e.g., 'archives').
 * @property {string} archive.collectionKey - The key name used to reference the collection in the archive (e.g. '_collection')
 * @property {string} archive.primaryIdKey - The key used to identify the primary id in the archive (e.g. 'id' or 'docId')
 * @property {string} archive.timestampKey - The key used to store the timestamp of when the item was archived (e.g. 'archivedAt')
 */
const config = {
  filter: { ...(!Archive && { deleted: false }) }, // filter the documents to keep across all collections. if you're not using jam:archive, it will assume you're using soft deletes.
  sort: { updatedAt: -1 }, // keep the most recent documents assuming you have an updatedAt on each doc. if you're using a different field name for timestamps, you'll want to change this.
  limit: 100, // limit offline documents to a max of 100 for each collection
  keepAll: true, // keep data for offline use for all collections using the global filter, sort, limit. to keep data for only certain collections, set this to false and then use collection.keep() for the collections you want to use offline.
  autoSync: true, // auto sync changes made offline when the user comes back online
  handleSyncErrors: async ({ replayErrors, keepErrors }) => {
    if (Meteor.isDevelopment) console.info(`[jam:offline] there was an issue with syncing. check the errors below`)
    if (replayErrors) console.error('replay', replayErrors); // if there are errors when the Meteor methods are replayed, they will be in array here with the name of the method, the method's args, and the error itself. you can use it to alert your user, logging purposes, etc.

    if (keepErrors) { // when syncing, if you're using a .keep filter or you have a global filter in the config that isn't an empty object, and there are errors reconciling with the server, they will be in an array here with the name of the collection and the error itself. you can customize how you handle these. by default, we clear the offline database for the collection since it could have stale data and reload the page.
      await Promise.allSettled(keepErrors.map(({ name }) => clear(name)));
      console.error('keep', keepErrors)
    }

    return;
  },
  ...(Archive && {
    archive: {
      name: 'archives',
      collectionKey: '_collection',
      primaryIdKey: 'id',
      timestampKey: 'archivedAt'
    }
  })
};

/**
 * Configures the settings by merging the provided options with the default configuration.
 *
 * @param {Object} options - The options to configure.
 * @param {Object} [options.filter] - Filter criteria for data.
 * @param {Object} [options.sort] - Sorting options.
 * @param {number} [options.limit] - Maximum number of items to return.
 * @param {boolean} [options.keepAll] - Whether to keep all items.
 * @param {boolean} [options.autoSync] - Whether to automatically synchronize data.
 * @param {Function} [options.handleSyncErrors] - Function to handle synchronization errors.
 * @param {Object} [options.archive] - Archive configuration settings.
 * @param {string} [options.archive.name] - The name of the archive collection (e.g., 'archive').
 * @param {string} [options.archive.collectionKey] - The key name used to reference the collection in the archive (e.g. '_collection')
 * @param {string} [options.archive.primaryIdKey] - The key used to identify the primary id in the archive (e.g. 'id' or 'docId')
 * @param {string} [options.archive.timestampKey] - The key used to store the timestamp of when the item was archived (e.g. 'archivedAt')
 *
 * @returns {Object} The updated configuration object.
 */
const configure = options => {
  check(options, {
    filter: Match.Maybe(Object),
    sort: Match.Maybe(Object),
    limit: Match.Maybe(Number),
    keepAll: Match.Maybe(Boolean),
    autoSync: Match.Maybe(Boolean),
    handleSyncErrors: Match.Maybe(Function),
    archive: Match.Maybe({
      name: String,
      collectionKey: String,
      primaryIdKey: String,
      timestampKey: String
    })
  });

  // if archive is set manually, then remove the { deleted: false } from the config since that assumes soft deletes
  const hasArchive = options.archive;
  if (hasArchive && !options.filter?.deleted && config.filter.deleted === false) delete config.filter.deleted;

  return Object.assign(config, options);
}

export const Offline = Object.freeze({
  config,
  configure
});
