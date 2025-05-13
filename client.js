// Importing the neccesary packages
import fs from "fs";
import net from "net";

// Storing Packets Here
const allPackets = [];
const receivedSequences = new Set();

// Connecting to the server to request all packets
function getAllPackets() {
  return new Promise((resolve, reject) => {
    const client = net.createConnection({ port: 3000 }, () => {
      console.log("Connected to server");

      const request = Buffer.alloc(2);
      request[0] = 1; // Using 1 to get all packets
      request[1] = 0; // Can be anything

      client.write(request);
    });

    client.on("data", (data) => {
      processPackets(data);
      client.end();
    });

    client.on("end", () => {
      console.log("Server closed connection");
      resolve();
    });

    client.on("error", (err) => {
      reject(err);
    });
  });
}

// Processing incoming packets
function processPackets(data) {
  for (let i = 0; i < data.length; i += 17) {
    if (i + 17 <= data.length) {
      const packet = {
        symbol: data.slice(i, i + 4).toString("ascii"),
        buySell: data.slice(i + 4, i + 5).toString("ascii"),
        quantity: data.readInt32BE(i + 5),
        price: data.readInt32BE(i + 9),
        sequence: data.readInt32BE(i + 13),
      };

      allPackets.push(packet);
      receivedSequences.add(packet.sequence);
      console.log(packet);
    }
  }
}

// Connecting to the server to request specific packets
function getMissingPacket(sequenceNum) {
  return new Promise((resolve, reject) => {
    const client = net.createConnection({ port: 3000 }, () => {
      console.log(`Requesting missing packet with sequence ${sequenceNum}`);

      const request = Buffer.alloc(2);
      request[0] = 2; // 2 indicates requesting specific packages
      request[1] = sequenceNum; // specific sequence that is missing

      client.write(request);
    });

    client.on("data", (data) => {
      if (data.length >= 17) {
        const packet = {
          symbol: data.slice(0, 4).toString("ascii"),
          buySellindicator: data.slice(4, 5).toString("ascii"),
          quantity: data.readInt32BE(5),
          price: data.readInt32BE(9),
          sequence: data.readInt32BE(13),
        };

        allPackets.push(packet);
        receivedSequences.add(packet.sequence);

        console.log(
          `Received missing packet: ${packet.symbol}, sequence: ${packet.sequence}`
        );

        client.end();
        resolve();
      }
    });

    client.on("error", (err) => {
      console.error(`Error requesting packet ${sequenceNum}:`, err);
      reject(err);
    });

    client.on("close", () => {
      console.log(`Connection closed while requesting sequence ${sequenceNum}`);
      resolve();
    });
  });
}

async function main() {
  try {
    await getAllPackets();

    const maxSequence = Math.max(...[...receivedSequences]);
    const missingSequences = [];

    for (let seq = 1; seq <= maxSequence; seq++) {
      if (!receivedSequences.has(seq)) {
        missingSequences.push(seq);
      }
    }

    console.log(`Missing sequences:`, missingSequences);

    for (const seq of missingSequences) {
      await getMissingPacket(seq);
    }

    allPackets.sort((a, b) => a.sequence - b.sequence);

    // A new file is created named output.json holding the JSON data
    fs.writeFileSync("output.json", JSON.stringify(allPackets, null, 2));

    return allPackets;
  } catch (error) {
    console.error("Error:", error);
  }
}

main();
