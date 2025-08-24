// index.js
const { makeWASocket, useMultiFileAuthState } = require("@whiskeysockets/baileys")
const pino = require("pino")
const chalk = require("chalk")
const readline = require("readline")

// Import file bot (fitur & menu)
const registerBotHandler = require("./bot")

// true = Pairing Code || false = Scan QR
const usePairingCode = true

// Prompt input terminal
async function question(prompt) {
    process.stdout.write(prompt)
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    })
    return new Promise((resolve) => rl.question("", (ans) => {
        rl.close()
        resolve(ans)
    }))
}

// Koneksi WhatsApp
async function connectToWhatsApp() {
    console.log(chalk.blue("Memulai Koneksi Ke WhatsApp..."))
    
    const { state, saveCreds } = await useMultiFileAuthState("./PutraoffcSesi")
    
    const sock = makeWASocket({
        logger: pino({ level: "silent" }),
        printQRInTerminal: !usePairingCode,
        auth: state,
        browser: ["PutraOffc", "Chrome", "1.0.0"]
    })
    
    // Pairing code 
    if (usePairingCode && !sock.authState.creds.registered) {
        console.log(chalk.green("Masukan Nomor Dengan Awalan 62"))
        const phoneNumber = await question(">")
        const code = await sock.requestPairingCode(phoneNumber.trim())
        console.log(chalk.cyan(`Pairing Code: ${code}`))
    }

    sock.ev.on("creds.update", saveCreds)
    sock.ev.on("connection.update", (update) => {
        const { connection } = update
        if (connection === "close") {
            console.log(chalk.red("Koneksi terputus, mencoba ulang..."))
            connectToWhatsApp()
        } else if (connection === "open") {
            console.log(chalk.green("✅ Bot berhasil terhubung!"))
        }
    })

    // Panggil semua handler fitur dari bot.js
    registerBotHandler(sock)
}

connectToWhatsApp()
