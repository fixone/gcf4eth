const config = require('./config')
const Web3 = require('web3')
const keth = require('keythereum')
const Tx = require('ethereumjs-tx')


var web3 = null
var initNetwork = cfg => {
    web3 = new Web3(Web3.givenProvider || cfg)
}

exports.getBlock = (req,res) => {
    if(web3 ==  null) {
        initNetwork(config.web3ws)
    }
    if(web3 != null) {
        web3.eth.getBlock(req.params.blkid)
        .then(b => {
            res.json(Object.assign({"errorMessage":"OK","errorCode":0},b))
        })
        .catch(e => {
            console.log("get blk err",e)
             res.json({errorMessage:"error","errorCode":12})
        })
    } else {
        console.log("null tx")
        res.json({errorMessage:"null tx","errorCode":11})
    } 
}


exports.getTransaction = (req,res) => {
    if(web3 ==  null) {
        initNetwork(config.web3ws)
    }
    if(web3 != null) {
        console.log("looking for tx",req.params.txid)
        web3.eth.getTransaction(req.params.txid)
        .then(t=>{
            if(!t) {
                console.log("null tx")
                res.json({errorMessage:"null tx","errorCode":1})    
            } else {
                web3.eth.getBlock("latest").then(lb => {
                    t.confirmations = 0
                    if(lb.number != null && t.blockNumber != null && lb.number > t.blockNumber) {
                        t.confirmations = lb.number - t.blockNumber
                    }
                    t.amount = parseFloat(web3.utils.fromWei(t.value,"ether"))
                    t.txid = t.hash
                    t.details = [{account:1,address:t.to,category:"receive",amount:t.amount}]
                    res.json( Object.assign({"errorMessage":"OK","errorCode":0},t))
                })
            }
        })
        .catch(e=>{
            console.log("error gt",e)
            res.json({"errorMessage":e,"errorCode":3})
        })
    }
}


exports.send = (req,res) => {
    console.log(req.body)
    let params = req.body
    if(web3 == null) {
        initNetwork(config.web3ws)
    }
    if( web3 != null) {
        if(params.key != null && params.data != null) {
            web3.eth.getGasPrice().then(gp => {
                console.log("gas price is",gp)
                let gasPriceHex = web3.utils.toHex(gp+1000)
                let gasLimitHex = web3.utils.toHex(params.gas || 100000)
                ///get address from key
                let sender = keth.privateKeyToAddress(params.key)
                console.log("sender is", sender)
                //get nonce
                web3.eth.getTransactionCount(sender)
                .then(cnt => {
                    console.log(sender,"nonce is", cnt)
                    let nonceHex = web3.utils.toHex(cnt)
                    /// build raw tx
                    let rawTx = {
                        gasPrice: gasPriceHex,
                        gasLimit: gasLimitHex,
                        data: params.data,
                        from: sender,
                        to: sender,
                        nonce: nonceHex,
                        value: 0x0
                    }
                    ///build tx
                    let tx = new Tx(rawTx)
                    console.log("raw tx",rawTx)
                    //sign tx
                    tx.sign(new Buffer(params.key,'hex'))
                    tx = tx.serialize().toString("hex")
                    if(tx.substring(0,3) != '0x')
                        tx = '0x'+tx 
                    //send tx
                    console.log("sending signed tx",tx)
                    web3.eth.sendSignedTransaction(tx)
                    .on('receipt', r => {
                        console.log("tx receipt for", r.transactionHash,"included in",r.blockHash,"position",r.transactionIndex)
                    })
                    .on('error' , e=> {
                        console.log("send err",e)
                        res.json({"errorCode":23,"errorMessage":"error"})
                    })
                    .once('transactionHash', hash => {
                        console.log("tx hash is",hash)
                        res.json({"errorCode":0,"errorMessage":"OK","hash":hash})
                    })
                })
            })
        } else {
            res.json({"errorMessage":"missing required parameters: key, data","errorCode":21})
        }
    }
}
