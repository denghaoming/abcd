import React, { Component } from 'react'
import { withNavigation } from '../../hocs'
import "./Token.css"
import WalletState, { CHAIN_ID, ZERO_ADDRESS, CHAIN_ERROR_TIP, CHAIN_SYMBOL } from '../../state/WalletState';
import loading from '../../components/loading/Loading'
import toast from '../../components/toast/toast'
import Web3 from 'web3'
import { ERC20_ABI } from "../../abi/erc20"
import { showCountdownTime, showFromWei, showLongAccount } from '../../utils'
import BN from 'bn.js'
import Swiper, { SwipeRef } from 'react-tiga-swiper';
import 'react-tiga-swiper/dist/index.css';

import copy from 'copy-to-clipboard';
import banner1 from "../../images/banner1.png"
import banner2 from "../../images/banner2.png"
import banner3 from "../../images/banner3.png"
import IconClock from "../../images/IconClock.png"
import IconHelp from "../../images/IconHelp.png"
import IconInvite from "../../images/IconInvite.png"
import Saly from "../../images/Saly.png"

import Header from '../Header';
import Footer from '../Footer';

class Token extends Component {
    state = {
        chainId: 0,
        account: "",
        lang: "EN",
        local: { presaleLimit: "每个持币地址限购 1 份" },
        level: 0,
        swiperData: [banner1, banner2, banner3],
    }
    constructor(props) {
        super(props);
        this.refreshInfo = this.refreshInfo.bind(this);
    }
    componentDidMount() {
        this.handleAccountsChanged();
        WalletState.onStateChanged(this.handleAccountsChanged);
        this.refreshInfo();
    }

    componentWillUnmount() {
        WalletState.removeListener(this.handleAccountsChanged);
        if (this._refreshInfoIntervel) {
            clearInterval(this._refreshInfoIntervel);
        }
    }

    handleAccountsChanged = () => {
        console.log(WalletState.wallet.lang);
        const wallet = WalletState.wallet;
        let page = this;
        page.setState({
            chainId: wallet.chainId,
            account: wallet.account,
            lang: WalletState.wallet.lang,
            local: page.getLocal()
        });
        this.getInfo();
    }

    getLocal() {
        let local = {};
        return local;
    }

    _refreshInfoIntervel;
    refreshInfo() {
        if (this._refreshInfoIntervel) {
            clearInterval(this._refreshInfoIntervel);
        }
        this._refreshInfoIntervel = setInterval(() => {
            this.getInfo();
        }, 3000);
    }

    async getInfo() {
        if (WalletState.wallet.chainId != CHAIN_ID) {
            return;
        }
        try {
            const web3 = new Web3(Web3.givenProvider);
            const tokenContract = new web3.eth.Contract(ERC20_ABI, WalletState.config.Token);
            const tokenInfo = await tokenContract.methods.getTokenInfo().call();
            //代币精度
            let tokenDecimals = parseInt(tokenInfo[0]);
            //代币符号
            let tokenSymbol = tokenInfo[1];
            this.setState({
                tokenDecimals: tokenDecimals,
                tokenSymbol: tokenSymbol,
            })

            let account = WalletState.wallet.account;
            if (account) {
                const userInfo = await tokenContract.methods.getUserInfo(account).call();
                let level = parseInt(userInfo[0]);
                //总锁仓数量
                let lockAmount = new BN(userInfo[1], 10);
                //总释放数量
                let releaseAmount = new BN(userInfo[2], 10);
                //已领取数量
                let claimedAmount = new BN(userInfo[3], 10);
                //团队人数
                let teamNum = parseInt(userInfo[4]);
                //代币余额
                let tokenBalance = userInfo[5];
                //直推人数
                let binderLength = parseInt(userInfo[6]);
                //上级邀请人
                let invitor = userInfo[7];
                //待解锁数量
                let pendingLock = lockAmount.sub(releaseAmount);
                //待领取数量
                let pendingClaim = releaseAmount.sub(claimedAmount);
                this.setState({
                    level: level,
                    binderLength: binderLength,
                    teamNum: teamNum,
                    invitor: invitor,
                    tokenBalance: showFromWei(tokenBalance, tokenDecimals, 2),
                    pendingLock: showFromWei(pendingLock, tokenDecimals, 2),
                    pendingClaim: showFromWei(pendingClaim, tokenDecimals, 2),
                });
            }
        } catch (e) {
            console.log("getInfo", e.message);
            toast.show(e.message);
        } finally {
        }
    }

    //领取代币
    async claim() {
        let account = WalletState.wallet.account;
        if (!account) {
            this.connectWallet();
            return;
        }
        loading.show();
        try {
            const web3 = new Web3(Web3.givenProvider);
            const tokenContract = new web3.eth.Contract(ERC20_ABI, WalletState.config.Token);
            var estimateGas = await tokenContract.methods.claim().estimateGas({ from: account });
            var transaction = await tokenContract.methods.claim().send({ from: account });
            if (transaction.status) {
                toast.show("领取成功");
            } else {
                toast.show("领取失败");
            }
        } catch (e) {
            console.log("e", e);
            toast.show(e.message);
        } finally {
            loading.hide();
        }
    }

    //绑定上级邀请人
    async bindInvitor() {
        let account = WalletState.wallet.account;
        if (!account) {
            this.connectWallet();
            return;
        }
        loading.show();
        try {
            const web3 = new Web3(Web3.givenProvider);
            const tokenContract = new web3.eth.Contract(ERC20_ABI, WalletState.config.Token);
            let invitor = this.getRef();
            if (!invitor) {
                invitor = ZERO_ADDRESS;
            }
            var estimateGas = await tokenContract.methods.bind(invitor).estimateGas({ from: account });
            var transaction = await tokenContract.methods.bind(invitor).send({ from: account });
            if (transaction.status) {
                toast.show("绑定成功");
            } else {
                toast.show("绑定失败");
            }
        } catch (e) {
            console.log("e", e);
            toast.show(e.message);
        } finally {
            loading.hide();
        }
    }

    //获取邀请人
    getRef() {
        //先从链接获取，如果有，直接使用
        var url = window.location.href;
        var obj = new Object();
        var scan_url = url.split("?");
        if (2 == scan_url.length) {
            scan_url = scan_url[1];
            var strs = scan_url.split("&");
            for (var x in strs) {
                var arr = strs[x].split("=");
                obj[arr[0]] = arr[1];
                //链接里有邀请人
                if ("ref" == arr[0] && arr[1]) {
                    return arr[1];
                }
            }
        }
        //从浏览器缓存获取，这里可能部分浏览器不支持
        var storage = window.localStorage;
        if (storage) {
            return storage["ref"];
        }
        return null;
    }

    //邀请好友
    invite() {
        if (WalletState.wallet.account) {
            var url = window.location.href;
            url = url.split("?")[0];
            let inviteLink = url + "?ref=" + WalletState.wallet.account;
            if (copy(inviteLink)) {
                toast.show("邀请链接已复制")
            } else {
                toast.show("邀请失败")
            }
        }

    }

    connectWallet() {
        WalletState.connetWallet();
    }

    showLevelLabel(level) {
        switch (level) {
            case 1: return '推广者';
            case 2: return '团队长';
            case 3: return '节点';
            case 4: return '超级节点';
        }
        return '会员';
    }

    render() {
        return (
            <div className="Token">
                <Header></Header>
                <div className="Banners ModuleTop">
                    <Swiper
                        className="Banner"
                        autoPlay={5000}
                        selectedIndex={0}
                        showIndicators={false}
                        showDots={false}
                        direction="horizontal"
                        loop={true}>
                        {this.state.swiperData.map((item, index) => (
                            <img className='Banner' key={index} src={item}></img>
                        ))}
                    </Swiper>
                </div>

                <div className='Module ModuleTop CountdownR'>
                    <div className='ModuleContentWitdh flex'>
                        <img className='clock' src={IconClock}></img>
                        <div className='Tip'>解锁规则</div>
                    </div>
                    <div className='ModuleContentWitdh Text mt5' style={{ whiteSpace: 'pre-wrap' }}>
                        {'会员邀请他人购买释放锁仓代币\n不同等级会员释放比例不同\n'}
                    </div>
                </div>

                <div className='Module ModuleTop'>
                    <div className='ModuleContentWitdh RuleTitle'>
                        <div>上级邀请人</div>
                        <div>{showLongAccount(this.state.invitor)}</div>
                    </div>
                    <div className='mt20 prettyBg button' onClick={this.bindInvitor.bind(this)}>绑定上级邀请人</div>
                </div>

                <div className='Module ModuleTop'>
                    <div className='ModuleContentWitdh RuleTitle'>
                        <div>会员等级</div>
                        <div>{this.showLevelLabel(this.state.level)}</div>
                    </div>
                    <div className='ModuleContentWitdh RuleTitle mt5'>
                        <div>直推人数</div>
                        <div>{this.state.binderLength}</div>
                    </div>
                    <div className='ModuleContentWitdh RuleTitle mt5'>
                        <div>团队人数</div>
                        <div>{this.state.teamNum}</div>
                    </div>
                    <div className='mt20 prettyBg button' onClick={this.invite.bind(this)}>邀请好友</div>
                </div>

                <div className='Module mt20 mb60'>
                    <div className='ModuleContentWitdh RuleTitle'>
                        <div>代币余额</div>
                        <div>{this.state.tokenBalance}</div>
                    </div>
                    <div className='ModuleContentWitdh RuleTitle mt5'>
                        <div>待解锁代币</div>
                        <div>{this.state.pendingLock}</div>
                    </div>
                    <div className='ModuleContentWitdh RuleTitle mt5'>
                        <div>待领取代币</div>
                        <div>{this.state.pendingClaim}</div>
                    </div>
                    <div className='mt20 prettyBg button' onClick={this.claim.bind(this)}>领取代币</div>
                </div>
            </div>
        );
    }
}

export default withNavigation(Token);