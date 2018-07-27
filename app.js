var express = require('express')
var serve = require('express-static');
var queryString = require('querystring')
var https = require('https')
var fs = require('fs')

var WebSocketServer = require('websocket').server;

var app = express()

function formateDate(timestamp) {
    return timestamp.getFullYear() + '-' + timestamp.getMonth() + '-'
        + timestamp.getDay() + ' ' + timestamp.getHours() + ':' + timestamp.getMinutes() + ':' + timestamp.getSeconds()
}

// 一个日志函数
function loginfo(logConent) {
    let timestamp = new Date();
    let format = formateDate(timestamp);
    console.log('[' + format + ' --> Received Message:]' + logConent);
}

function logobj(logConent) {
    let timestamp = new Date();
    let format = formateDate(timestamp);
    console.log('[' + format + ' --> Received Message:]');
    console.dir(logConent);
}
// 用express创建一个https服务器
var server = https.createServer(
    {
        key: fs.readFileSync('./cert/server.key', 'utf8'),
        cert: fs.readFileSync('./cert/server.crt', 'utf8'),
        passphrase: '123456'
    },
    app
);
// 在8080端口启动监听
server.listen(8080, function () {
    loginfo('server is listening on 8080!')
});
// 基于https创建websocket服务器
wsServer = new WebSocketServer({
    httpServer: server,
    autoAcceptConnections: false
});

function originIsAllowed(origin) {
    //写入是否拒绝接入逻辑.
    return true;
}
var users = [];
var connections = [];

function isUserUnique(username) {
    for (let i = 0; i < users.length; i++) {
        if (users[i] === username) {
            return false;
        }
    }
    return true;
}

function getConnection(username) {
    for (let i = 0; i < connections.length; i++) {
        if (connections[i].clientId === username) {
            return connections[i];
        }
    }
    return null;
}
// 发送消息
function sendToUser(msg, conn) {
    let req = JSON.stringify(msg);
    conn.send(req);
}

function sendToAllUser(msg) {
    let req = JSON.stringify(msg);
    for (let i = 0; i < connections.length; i++) {
        connections[i].send(req);
    }
}

function clearUserInfo(username) {
    for (let i = 0; i < connections.length; i++) {
        if (connections[i].clientId === username) {
            connections.splice(i, 1);
            break;
        }
    }
    for (let i = 0; i < users.length; i++) {
        if (users[i] === username) {
            users.splice(i, 1);
            break;
        }
    }
}
// login function
function handleLogin(jsonMsg, conn) {
    let req = '';
    if (!isUserUnique(jsonMsg.username)) {
        req = {
            code: 0,
            msg: '用户名已经被使用，请更换用户名登录！',
            type: 'login'
        }
        sendToUser(req, conn);
    } else {
        users.push(jsonMsg.username)
        conn.clientId = jsonMsg.username;
        connections.push(conn);
        req = {
            code: 1,
            msg: '登陆成功！',
            type: 'login'
        }
        sendToUser(req, conn);
        sendToAllUser({ type: 'users', data: users });
    }
}

function handleChat(jsonMsg) {
    sendToAllUser(jsonMsg);
}

function handleVideoOfferMsg(jsonMsg) {
    let conn = getConnection(jsonMsg.toUser);
    sendToUser(jsonMsg, conn);
}

function handleVideoAnswerMsg(jsonMsg) {
    let conn = getConnection(jsonMsg.toUser);
    sendToUser(jsonMsg, conn);
}

function handleIceCandidateMsg(jsonMsg){
    let conn = getConnection(jsonMsg.toUser);
    sendToUser(jsonMsg, conn);
}
// 处理消息转发
function handleUTFMsg(msg, conn) {
    let jsonMsg = JSON.parse(msg);
    switch (jsonMsg.type) {
        case 'login':
            handleLogin(jsonMsg, conn);
            break;
        case 'chat':
            jsonMsg.fromUser = conn.clientId;
            handleChat(jsonMsg, conn);
            break;
        case 'video-offer':
            handleVideoOfferMsg(jsonMsg);
            break;
        case 'video-answer':
            handleVideoAnswerMsg(jsonMsg);
            break;
        case 'new-ice-candidate':
            handleIceCandidateMsg(jsonMsg);
            break;
        default:
            console.log('handle the default func')
            break;
    }

}

wsServer.on('request', function (request) {
    loginfo('客户端请求连接...');
    if (!originIsAllowed(request.origin)) {
        // Make sure we only accept requests from an allowed origin
        request.reject();
        loginfo(' Connection from origin ' + request.origin + ' rejected.');
        return;
    }

    var connection = request.accept('json', request.origin);
    loginfo(request.origin + ' Connection accepted.');
    connection.on('message', function (message) {
        logobj(message);
        if (message.type === 'utf8') {
            logobj(message.utf8Data);
            handleUTFMsg(message.utf8Data, connection);
            // connection.sendUTF(message.utf8Data);
        }
        else if (message.type === 'binary') {
            loginfo('Received Binary Message of ' + message.binaryData.length + ' bytes');
            connection.sendBytes(message.binaryData);
        }
    });
    connection.on('close', function (reasonCode, description) {
        clearUserInfo(connection.clientId);
        sendToAllUser({ type: 'users', data: users });
        loginfo(' Peer ' + connection.remoteAddress + ' disconnected.');
    });
});
// app.post('/login', function (req, res) {
//     var str = ''
//     req.on('data', function (data) {
//         str += data;
//     });
//     req.on('end', function () {
//         let params = queryString.parse(str);
//         fs.readFile('./www/chat.html', 'utf8',  (err, data) => {
//             if (err) throw err;
//            res.write(data);
//            res.end();
//           })
//         //res.send({ code: 1 });
//     })

// })

app.use(serve('./www'))
