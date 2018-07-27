$(function () {
    loginfo('启动程序')
    $('#userinfo').hide();
});
var conn = null;
var peerConn = null;
function formateDate(timestamp) {
    return timestamp.getFullYear() + '-' + timestamp.getMonth() + '-'
        + timestamp.getDay() + ' ' + timestamp.getHours() + ':' + timestamp.getMinutes() + ':' + timestamp.getSeconds()
}

// 一个日志函数
function loginfo(logConent) {
    let timestamp = new Date();
    let format = formateDate(timestamp);
    //console.log('[' + format + ' --> Received Message:]' + logConent);
}

function logobj(logConent) {
    let timestamp = new Date();
    let format = formateDate(timestamp);
    /// console.log('[' + format + ' --> Received Message:]');
    //console.dir(logConent);
}

function logsendinfo(logConent) {
    let timestamp = new Date();
    let format = formateDate(timestamp);
    //console.log('[' + format + ' --> Send Message:]' + logConent);
}

function sendToServer(msg) {

    let jsonMsg = JSON.stringify(msg);
    logsendinfo(jsonMsg);
    conn.send(jsonMsg);
}
var user;
function connect() {
    loginfo('开始连接.....');
    var serverUrl;
    var schemas = "ws";
    if (window.location.protocol === 'https:') {
        schemas += 's';
    }
    serverUrl = schemas + '://' + window.location.host;
    conn = new WebSocket(serverUrl, 'json');

    conn.onopen = function (event) {
        loginfo('连接打开，发送用户名密码登陆！');
        let username = document.getElementById('username').value;
        let password = document.getElementById('password').value;
        if (!username || username === '') {
            alert('请填写用户名!');
            return;
        }
        user = username
        let req = {
            type: 'login',
            username: username,
            password: password
        };
        sendToServer(req);
    }

    conn.onmessage = function (event) {
        let msg = event.data;
        loginfo(msg)
        handleMsg(msg)
    }
}

function chatSend() {
    let req = {};
    let msg = $('#msg').val();
    if (!msg || msg === '') {
        alert('发送消息不能为空!')
        return;
    }
    req.msg = msg;
    req.type = 'chat';
    req.user = user;
    req.time = formateDate(new Date());
    sendToServer(req);
}

function chatKeySend(event) {
    if (event.keyCode === 13) {
        let req = {};
        let msg = $('#msg').val();
        if (!msg || msg === '') {
            alert('发送消息不能为空!')
            return;
        }
        req.msg = msg;
        req.type = 'chat';
        req.user = user;
        req.time = formateDate(new Date());
        sendToServer(req);
    }
}

function handleVideoOfferMsg(jsonMsg) {
    console.log('---->handleVideoOfferMsg');

    var localStream = null;
    createPeerConnection();
    var desc = new RTCSessionDescription(jsonMsg.sdp);

    peerConn.setRemoteDescription(desc).then(function () {
        return navigator.mediaDevices.getUserMedia({ 'video': true, 'audio': true });
    }).then(function (stream) {
        localStream = stream;
        console.log('----> 连接中....');
        if (!document.getElementById('myvideo')) {
            let videostr = '<video class="myvideo" id="myvideo" autoplay>我的</video>'
            $('#videobox').append(videostr);
        }
        document.getElementById('myvideo').srcObject = localStream;
        return peerConn.addStream(localStream);
    }).then(function () {

        if (peerConn.localDescription.sdp !== '') {
            console.error('answer-------------' + peerConn.signalingState);
            return;
        }
        return peerConn.createAnswer().then(anwser => {
            return peerConn.setLocalDescription(anwser)
        }).then(function () {
            sendToServer({
                type: 'video-answer',
                fromUser: user,
                toUser: jsonMsg.fromUser,
                sdp: peerConn.localDescription
            })
        })
    }).catch(handleGetUserMediaError);

}

function handleVideoAnswerMsg(jsonMsg) {
    console.log('---->handleVideoAnswerMsg 加入远程sdp：');
    var sdp = new RTCSessionDescription(jsonMsg.sdp)
    peerConn.setRemoteDescription(sdp);
}

function handleIceCandidateMsg(jsonMsg) {
    console.log('---->handleIceCandidateMsg 加入ice');
    let candidate = new RTCIceCandidate(jsonMsg.candidate);
    peerConn.addIceCandidate(candidate)
}

function handleMsg(msg) {
    let jsonMsg = JSON.parse(msg);
    switch (jsonMsg.type) {
        case 'login':
            if (jsonMsg.code === 1) {
                // 更新当前用户
                $('#loginPage').hide();
                $('#userinfo').show();
                console.log('当前用户:' + user)
                $('#curuser').text(user);
            } else {
                alert(jsonMsg.msg)
            }
            break;
        case 'users':
            let users = jsonMsg.data;
            $('#users').empty();
            $('#users').append('<a href="#" class="list-group-item list-group-item-action active"> 在线用户</a>');
            users.forEach(element => {
                $('#users').append('<a href="#" onclick="videocall(\'' + element + '\')" class="list-group-item list-group-item-action">' + element + '</a>');
            });
            break;
        case 'chat':
            let msgStr = '<div>'
            msgStr += '<span class="chatname">用户 [' + jsonMsg.user + ']:</span>';
            msgStr += '<div class="chatcontent">' + jsonMsg.msg + '</div>';
            msgStr += '<div class="text-right"><span class="badge badge-info">' + jsonMsg.time + '</span></div></div>';
            $('#chatbox').append(msgStr);
            break;
        case 'video-offer':
            targetUser = jsonMsg.fromUser;
            handleVideoOfferMsg(jsonMsg)
            break;
        case 'video-answer':
            targetUser = jsonMsg.fromUser;
            handleVideoAnswerMsg(jsonMsg)
            break;
        case 'new-ice-candidate':
            targetUser = jsonMsg.fromUser;
            handleIceCandidateMsg(jsonMsg);
            break;
        default:
            console.log('handle the default func')
            break;
    }
}

function closeVideoCall() {
    console.log('视频关闭');
    peerConn.close();
}
function handleGetUserMediaError(e) {
    switch (e.name) {
        case "NotFoundError":
            alert("不能打通，因为没有发现任何摄像头或麦克风！");
            break;
        case "SecurityError":
        case "PermissionDeniedError":
            alert("摄像头或麦克风使用权限被拒绝！");
            break;
        default:
            alert("打开摄像头或麦克风错误: " + e.message);
            break;
    }

    closeVideoCall();
}

function handleNegotiationneed() {
    console.log('---->发送video-offer，如果是stable状态：' + peerConn.signalingState);

    if (peerConn.signalingState !== 'stable') {
        console.error('-------------' + peerConn.signalingState);
        return;
    }
    // 创建sdp 并设置本地sdp
    peerConn.createOffer().then(offer => {
        peerConn.setLocalDescription(offer);
    }).then(function () {
        logsendinfo('发送给对方sdp');
        sendToServer({
            type: 'video-offer',
            fromUser: user,
            toUser: targetUser,
            sdp: peerConn.localDescription
        })
    })
}

function handleremotestream(event) {
    console.log('---> 开始设置远程流！');
    if (!document.getElementById('remotevideo')) {
        let videostr = '<video class="myvideo" id="remotevideo" autoplay>我的</video>'
        $('#videobox').append(videostr);
    }
    document.getElementById('remotevideo').srcObject = event.stream;
}

function handleICECandidate(event) {
    console.log('--->触发icecandidate事件！' + event.candidate);
    if (event.candidate) {
        sendToServer({
            type: "new-ice-candidate",
            toUser: targetUser,
            fromUser: user,
            candidate: event.candidate
        });
    }
}
var myHostname = window.location.hostname;

function createPeerConnection() {
    console.log('--->createPeerConnection')
    if (peerConn === null) {
        console.log('--->用户：' + user + '--turn server：' + myHostname);
        peerConn = new RTCPeerConnection({
            iceServers: [     // Information about ICE servers - Use your own!
                {
                    urls: "turn:" + myHostname,  // A TURN server
                    username: "webrtc",
                    credential: "turnserver"
                }
            ]
        });
        peerConn.onnegotiationneeded = handleNegotiationneed;
        peerConn.onaddstream = handleremotestream;
        peerConn.onicecandidate = handleICECandidate;
    }

}
var targetUser;
function videocall(toUser) {
    if (toUser === user) {
        alert('不能和自己发起视频通话!');
        return;
    }
    console.log('---->发起视频');
    targetUser = toUser;
    navigator.mediaDevices.getUserMedia({ 'video': true, 'audio': true }).then(function (stream) {
        // console.log('----> 连接中....');
        if (!document.getElementById('myvideo')) {
            let videostr = '<video class="myvideo" id="myvideo" autoplay>我的</video>'
            $('#videobox').append(videostr);
        }
        document.getElementById('myvideo').srcObject = stream;
        // 向对方发起视频请求
        if (peerConn === null) {
            createPeerConnection();
        }
        peerConn.addStream(stream);
    }).catch(handleGetUserMediaError)
}

