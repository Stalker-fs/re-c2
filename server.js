const https = require('https');
const url = require('url');
const fs = require('fs');
const ejs = require('ejs');
// const net = require('net');
const tls = require('tls');

let integ;
let so_id;
// Налаштування порту
const WEB_PORT = 3000;
const C2_PORT = 3001;

const options = {
    key: fs.readFileSync('privatekey.pem'),
    cert: fs.readFileSync('certificate.pem'),
};
for (let i = 1; i <= 100; i++) {
    setTimeout(() => {
        integ = i;
        console.log(i);
    }, i * 1000); // Затримка в 1 секунду (1000 мілісекунд) для кожного числа
}

// Створення сервера
const server = https.createServer(options, (req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const path = parsedUrl.pathname;
    const query = parsedUrl.query;

    switch(req.method) {
        case 'GET':
            switch (path){
                case '/doit':
                    res.writeHead(200, { 'Content-Type': 'text/plain' });
                    // res.end(`Hello ${query.name}, you number ${integ} and id:${query.id}`);
                    ejs.renderFile('./page2.ejs', { integ: integ, query: query }, (err, str) => {
                        if (err) {
                            res.writeHead(500, { 'Content-Type': 'text/plain' });
                            res.end('Server error');
                        } else {
                            res.writeHead(500, { 'Content-Type': 'text/html' });
                            res.end(str);
                        }
                    })
                    break;
                case '/':
                    res.writeHead(200, { 'Content-Type': 'text/html' });
                    fs.readFile('./index.html', (err, data) => {
                        if (err) {
                            res.writeHead(500, { 'Content-Type': 'text/plain' });
                            res.end('Server error');
                        } else {
                            res.writeHead(200, {'Content-Type': 'text/html'});
                            res.end(data);
                        }
                    })
            }
            break;
        case 'POST':
            let body = '';
            req.on('data', ch => {
                body += ch.toString();
            });
            switch(path){
                case '/send-id':
                    req.on('end', () => {
                        const params = new URLSearchParams(body);
                        if (so_id) {
                            so_id.write(`Id: ${params.get('id')}\n`);
                            res.writeHead(200, { 'Content-Type': 'text/plain' });
                            res.end('Ok');
                        } else {
                            res.writeHead(500, { 'Content-Type': 'text/plain' });
                            res.end('No TCP client connected');
                        }
                    });

                    res.on('error', (err) => {
                        console.error(`Error: ${err}`);
                        res.writeHead(500, { 'Content-Type': 'text/plain' });
                        res.end('Server error');
                    });
                    break;
            }
            break;
    }
});

const server2 = tls.createServer(options, (so) => {
    console.log(`Client connected with: ${so.remoteAddress}:${so.remotePort}`);
    so_id = so;

    so.on('data', (data) => {
        console.log(`Resv data: ${data}`);
        so.write(`Send: ${integ}\n`);
    });

    so.on('end', () => {
        console.log('Client disconect');
    });

    so.on('error', (err) => {
        console.error(`Error: ${err}`);
    });
});

// Запуск сервера
server.listen(WEB_PORT, () => {
    console.log(`WebServer is running at http://172.16.218.140:${WEB_PORT}`);
});

server2.listen(C2_PORT, () => {
    console.log(`C2Server is running at http://172.16.218.140:${C2_PORT}`);
});


