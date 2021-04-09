// truffle.js config for klaytn.
const PrivateKeyConnector = require('connect-privkey-to-provider');
const NETWORK_ID = '1001'
const GASLIMIT = '10000000'
const URL = 'https://api.baobab.klaytn.net:8651'
const PRIVAYR_KEY = '0x8db85d75b1ace77deeb5fbc46879694a9611ce92f02f7f4611b87f0176c5dfc6'

module.exports = {
    networks : {
        klaytn : {
            provider: new PrivateKeyConnector(PRIVAYR_KEY, URL),
            network_id: NETWORK_ID,
            gas: GASLIMIT,
            gasPrice: null,
        }
    }
}