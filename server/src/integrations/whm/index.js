const whmClient = require('./whm.client');
const AccountsService = require('./accounts.service');
const PackagesService = require('./packages.service');
const BandwidthService = require('./bandwidth.service');
const SSLService = require('./ssl.service');
const SessionsService = require('./sessions.service');
const DNSService = require('./dns.service');

module.exports = {
  whmClient,
  AccountsService,
  PackagesService,
  BandwidthService,
  SSLService,
  SessionsService,
  DNSService,
};
