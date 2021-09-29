const axios = require("axios");
require("dotenv").config();

//import des modeles
const { bins, binsdeposits, tokens } = require("../models");

//updating our database of binDeposits from ttn network
const updateBinDepositsDB = async () => {
  try {
    const response = await axios.get(
      "https://eu1.cloud.thethings.network/api/v3/as/applications/stage-samy/packages/storage/uplink_message",
      {
        headers: {
          Authorization: `Bearer ${process.env.TTN_API_SECRET}`,
        },
      }
    );

    ttn = response.data.split("\n");
    let len = ttn.length;
    let tab = [...ttn.splice(0, len - 1)];
    let newTab = [];
    let finalTab = [];

    for (const element of tab) {
      newTab.push(JSON.parse(element));
    }

    for (const element of newTab) {
      if (
        element.result.uplink_message.frm_payload !== "VEVTVA==" &&
        element.result.uplink_message.frm_payload !== "AA=="
      ) {
        finalTab.push(element);
      }
    }

    const allBinsDepositsInDB = await binsdeposits
      .find()
      .populate({ path: "bins_id" });

    //checking if import documents already exist or not in our DB
    for (let i = 0; i < finalTab.length; i++) {
      let alreadyExist = false;
      let depositTtnTime = new Date(
        finalTab[i].result.uplink_message.rx_metadata[0].time
      );
      let depositTtnEndDevice = finalTab[i].result.end_device_ids.device_id;
      let depositTtnToken = finalTab[
        i
      ].result.uplink_message.decoded_payload.id_badge.replace(/\s+/g, "");

      if (allBinsDepositsInDB.length !== 0) {
        for (let j = 0; j < allBinsDepositsInDB.length; j++) {
          if (
            allBinsDepositsInDB[j].deposit_date.getTime() ===
              depositTtnTime.getTime() &&
            allBinsDepositsInDB[j].bins_id.name.localeCompare(
              depositTtnEndDevice
            ) === 0
          ) {
            alreadyExist = true;
          }
          if (!alreadyExist && j === allBinsDepositsInDB.length - 1) {
            // on devra mettre le cycle_number à jour pour voir les vidanges
            // let cycle_number = String(
            //   ttnDeposits.result.uplink_message.decoded_payload.event
            // );

            //search 4 existingBin
            let existingBin = await bins
              .findOne({ name: depositTtnEndDevice })
              .populate({ path: "bintypes_id" });

            //search 4 existingToken
            let existingToken = await tokens.findOne({ code: depositTtnToken });

            //creating a new binsdeposits document
            let weight =
              finalTab[i].result.uplink_message.decoded_payload.poids;
            let deposit_date = depositTtnTime;
            let newBinDeposit = new binsdeposits({
              weight: weight,
              deposit_date: deposit_date,
              tokens_id: existingToken,
              bins_id: existingBin,
            });
            await newBinDeposit.save();
          }
        }
      } else {
        //search 4 existingBin
        let existingBin = await bins
          .findOne({ name: depositTtnEndDevice })
          .populate({ path: "bintypes_id" });

        //search 4 existingToken
        let existingToken = await tokens.findOne({ code: depositTtnToken });

        //creating a new binsdeposits document
        let weight = finalTab[i].result.uplink_message.decoded_payload.poids;
        let deposit_date = depositTtnTime;
        let newBinDeposit = new binsdeposits({
          weight: weight,
          deposit_date: deposit_date,
          tokens_id: existingToken,
          bins_id: existingBin,
        });
        await newBinDeposit.save();
      }
    }
  } catch (error) {}
};

module.exports = updateBinDepositsDB;
