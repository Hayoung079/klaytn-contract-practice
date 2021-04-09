import Caver from "caver-js";
import {Spinner} from "spin.js";

const config = {
  rpcURL: 'https://api.baobab.klaytn.net:8651'
}

const cav = new Caver(config.rpcURL);
const agContract = new cav.klay.Contract(DEPLOYED_ABI, DEPLOYED_ADDRESS);

const App = {
  auth: {
    accessType: 'keystore',
    keystore: '',
    password: ''
  },

  /* 시작화면
    1. 세션에 정보가 있다면(유효한 walletInstance)
      - 세션에 로그인한 정보를 가져와서 월렛에 다시 추가
      - UI 변경
    2. 아니면
      - 세션에 있는 정보 지우기
  */
  start: async function () {
    const walletFromSession = sessionStorage.getItem('walletInstance');
    if(walletFromSession){
      try{
        cav.klay.accounts.wallet.add(JSON.parse(walletFromSession));
        this.changeUI(JSON.parse(walletFromSession));
      }catch (e) {
        sessionStorage.removeItem('walletInstance');
      }
    }
  },

  // 파일 업로드
  handleImport: async function () {
    // keystore파일 유효성 검사
    const fileReader = new FileReader();
    fileReader.readAsText(event.target.files[0]);
    fileReader.onload = (event) => {
      try {
        if(!this.checkValidKeystore(event.target.result)) {
          $('#message').text('유효하지 않은 keystore 파일입니다.');
          return;
        }
        this.auth.keystore = event.target.result;
        $('#message').text('keystore 통과. 비밀번호를 입력하세요.');
        document.querySelector('#input-password').focus();
      }catch (event) {
        $('#message').text('유효하지 않은 keystore 파일입니다.');
        return;
      }
    }
  },

  // 비밀번호 입력
  handlePassword: async function () {
    this.auth.password = event.target.value; 
  },

  // 로그인
  handleLogin: async function () {
    if(this.auth.accessType === 'keystore') {
      try {
        // keystore와 비밀번호로 비밀키 가져오기
        const privateKey = cav.klay.accounts.decrypt(this.auth.keystore, this.auth.password).privateKey;
        this.integrateWallet(privateKey);
      } catch (e) {
        console.log(e)
        $('#message').text('비밀번호가 일치하지 않습니다. 다시 입력해주세요.');
        document.querySelector('#input-password').focus();
      }
    }
  },

  // 로그아웃
  handleLogout: async function () {
    this.removeWallet();
    // 새로고침 : 처음 상태의 UI로 돌아가기 위해
    location.reload();
  },

  // 랜덤 숫자 생성
  generateNumbers: async function () {
    // 10~59까지 숫자생성
    var num1 = Math.floor((Math.random() * 50) + 10); 
    var num2 = Math.floor((Math.random() * 50) + 10);
    sessionStorage.setItem('result', num1+num2);

    // 시작을 감추고 num1, num2 보이게
    $('#start').hide();
    $('#num1').text(num1);
    $('#num2').text(num2);
    $('#question').show();
    document.querySelector('#answer').focus();

    this.showTimer();
  },

  // 엔터키 누렀을 때 
  enterkey: async function () {
    if (window.event.keyCode == 13) {
      this.submitAnswer();
    }
  },

  // 정답 제출버튼
  submitAnswer: async function () {
    const result = sessionStorage.getItem('result');
    var answer = $('#answer').val();

    if(answer === result){
      if(confirm("짝짝짝~ 0.1 KLAY 받기")) {
        if(await this.callContractBalance() >= 0.1) {
          this.receiveKlay();
        }else {
          alert("죄송합니다. 컨트랙에 KLAY가 다 소모되었습니다.")
        }
      }
    }else {
      alert("땡!")
    }
  },

  // 송금하기
  deposit: async function () {
    var spiner = this.showSpinner();
    // 로그인된 계정이 owner인지 확인
    const walletInstance = this.getWallet();
    if(walletInstance) {
      // 오너계정이 아니면, return하여 함수 종료
      if((await this.callOwner()).toUpperCase() !== walletInstance.address.toUpperCase()) return;
      // 맞으면, input값을 받아 송금
      else {
        var amount = $('#amount').val();
        if(amount) {
          agContract.methods.deposit().send({
            from: walletInstance.address,
            gas: '250000',
            value: cav.utils.toPeb(amount, 'KLAY')
            // deposit함수는 타입이 payable이므로 value값이 있어야 함
          })
          // 트랜잭션 성공여부 확인
          .once('transactionHash', (txHash) => {
            console.log(`txHash: ${txHash}`);
          })
          .once('receipt', (receipt) => {
            console.log(`(#${receipt.blockNumber})`, receipt);
            spiner.stop();
            alert(amount + " KLAY를 컨트랙에 송금했습니다.")
            location.reload();
          })
          .once('error', (error) => {
            alert(error.message);
          })
        }
        return;
      }
    }
  },

  // 컨트랙 owner 월렛 계정 가져오기
  callOwner: async function () {  
    return await agContract.methods.owner().call();
  },

  // 컨트랙 잔액 조회
  callContractBalance: async function () {
    return await agContract.methods.getBalance().call();
  },

  // 현재 cav월렛에 있는 월렛 정보 가져오기
  getWallet: function () {
    if(cav.klay.accounts.wallet.length) {
      return cav.klay.accounts.wallet[0];
    }
  },

  // 올바른 keystore인지 확인
  checkValidKeystore: function (keystore) {
    const parsedKeystore = JSON.parse(keystore);
    const isVaildKeystore = parsedKeystore.version &&
      parsedKeystore.id &&
      parsedKeystore.address &&
      parsedKeystore.keyring;

    return isVaildKeystore;
  },

  // 비밀키로 월렛 인스턴스 가져오기
  integrateWallet: function (privateKey) {
    // 내 계정 정보를 가지고 있음
    const walletInstance = cav.klay.accounts.privateKeyToAccount(privateKey);
    cav.klay.accounts.wallet.add(walletInstance);
    // 세션에 계정정보 저장 - 계정이 로그인된 상태를 유지하기 위해
    sessionStorage.setItem('walletInstance', JSON.stringify(walletInstance));
    this.changeUI(walletInstance);
  },

  // auth 변수 초기화
  reset: function () {
    this.auth = {
      keystore: '',
      password: ''
    };
  },

  /* UI 변경하기
    1. modal 안 뜨게
    2. 로그인 버튼 안 보이게
    3. 로그아웃 버튼 보이게
    4. game 보이게
    5. 내 계정 주소 div에 추가
    6. 이벤트 잔액(owner가 deposit) 추가
    7. 로그인한 계정이 onwer면 deposit 부분 보이게
  */
  changeUI: async function (walletInstance) {
    $('#loginModal').modal('hide');
    $('#login').hide();
    $('#logout').show();
    $('#game').show();
    $('#address').append('<br>'+'<p>'+ '내 계정 주소: '+ walletInstance.address+'</p>');
    $('#contractBalance')
    .append('<p>'+ '이벤트 잔액: '+ cav.utils.fromPeb(await this.callContractBalance(), "KLAY")+' KLAY'+'</p>');

    if((await this.callOwner()).toUpperCase() === walletInstance.address.toUpperCase()) {
      $('#owner').show();
    }
  },

  // 월렛, 세션 초기화
  removeWallet: function () {
    cav.klay.accounts.wallet.clear();
    sessionStorage.removeItem('walletInstance');
    this.reset();
  },

  // 타이머
  showTimer: function () {
    var seconds = 3;
    $('#timer').text(seconds);

    var interval = setInterval(() => {
      $('#timer').text(--seconds);
      if(seconds <= 0) {
        $('#timer').text('');
        $('#answer').val('');
        $('#question').hide();
        $('#start').show();
        clearInterval(interval);
      }
    }, 1000);
  },

  // 로딩(트랜잭션)중에 스피너 UI보이게
  showSpinner: function () {
    var target = document.getElementById('spin');
    return new Spinner(opts).spin(target);
  },

  // 정답 맞췄을 때 클레이 받기
  receiveKlay: function () {
    var spinner = this.showSpinner();
    const walletInstance = this.getWallet();

    if(!walletInstance) return;

    agContract.methods.transfer(cav.utils.toPeb("0.1", "KLAY")).send({
      from: walletInstance.address,
      gas: '250000'
    })
    /* 트랜잭션 성공 확인 후 
      -receipt 받기 
      - 클레이튼 scope 링크 보이기
    */
    .then(function (receipt) {
      if(receipt.status) {
        spinner.stop();
        alert('0.1 KLAY가' + walletInstance.address +' 계정으로 지급되었습니다.');
        $('#transaction').html("");
        $('#transaction')
        .append(`<p><a href='https://baobab.klaytnscope.com/tx/${receipt.transactionHash}' 
                  target='_blank'>클레이튼 scope에서 트랜잭션 확인</a></p>`);
        
        // 이벤트 잔액 다시 보이기
        return agContract.methods.getBalance().call()
        .then(function (balance) {
          $('#contractBalance').html("");
          $('#contractBalance').append('<p>'+ '이벤트 잔액: '+ cav.utils.fromPeb(balance, "KLAY")+' KLAY'+'</p>');
        })
      }
    })
  }
};

window.App = App;

window.addEventListener("load", function () {
  App.start();
});

var opts = {
  lines: 10, // The number of lines to draw
  length: 30, // The length of each line
  width: 17, // The line thickness
  radius: 45, // The radius of the inner circle
  scale: 1, // Scales overall size of the spinner
  corners: 1, // Corner roundness (0..1)
  color: '#5bc0de', // CSS color or array of colors
  fadeColor: 'transparent', // CSS color or array of colors
  speed: 1, // Rounds per second
  rotate: 0, // The rotation offset
  animation: 'spinner-line-fade-quick', // The CSS animation name for the lines
  direction: 1, // 1: clockwise, -1: counterclockwise
  zIndex: 2e9, // The z-index (defaults to 2000000000)
  className: 'spinner', // The CSS class to assign to the spinner
  top: '50%', // Top position relative to parent
  left: '50%', // Left position relative to parent
  shadow: '0 0 1px transparent', // Box-shadow for the lines
  position: 'absolute' // Element positioning
};