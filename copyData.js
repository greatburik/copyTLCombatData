import { chromium } from "playwright"; // Correct import for Chromium from Playwright
import fs from "fs/promises";
import { google } from "googleapis";
import { listOfBuilds } from "./listOfBuilds.js";

const sheetId = "1qEXk2CBKqAZLBTeGmLL2xhQSvcgBwy_NRKPFypYcBqo";
const notFoundText = "not found";

function getRandomDelay(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

(async () => {
  // Launch a new browser instance
  const browser = await chromium.launch({
    headless: false, // Run with a visible UI
    slowMo: 50, // Adds a delay between actions (in ms)
  });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 }, // Typical desktop resolution
    deviceScaleFactor: 1, // Default scale factor
  });

  // Create a new page
  const page = await context.newPage();

  const selectors = {
    charName: ".rounded.text-green+span",
    combatPower: ".justify-between div p.flex.font-bold",
    skillTabButton: ".border-default.bg-default.text-dark+button",
    weaponsCombo: ".grow .mb-2 p.text-sm",
  };

  const buildsData = [];
  for (const buildLink of listOfBuilds) {
    let charName = "";
    let combatPower = "";
    let firstWeapon = "";
    let secondWeapon = "";

    try {
      // Navigate to the URL
      await page.goto(buildLink);
      await page.waitForTimeout(getRandomDelay(500, 2000));

      // Wait for the page to load and the necessary elements to be visible
      await page.waitForSelector(selectors.charName); // Adjust selector as needed for the name
      await page.waitForSelector(selectors.combatPower); // Adjust selector as needed for the combat power
      await page.waitForSelector(selectors.skillTabButton); // Adjust selector as needed for the combat power

      // Extract the name and Combat Power value
      charName = await page.$eval(selectors.charName, (el) =>
        el.textContent.trim()
      );
      combatPower = await page.$eval(selectors.combatPower, (el) =>
        el.textContent.trim()
      );

      await page.click(selectors.skillTabButton, {
        delay: getRandomDelay(50, 150),
      }); // Simulate human click
      await page.waitForTimeout(getRandomDelay(500, 2000));
      await page.waitForSelector(selectors.weaponsCombo);
      const weaponsCombo = await page.$eval(selectors.weaponsCombo, (el) =>
        el.textContent.trim()
      );
      const weaponsArray = weaponsCombo
        .split(" | ")
        .map((weapon) => weapon.trim());
      const [firstWeaponRaw, secondWeaponRaw] = weaponsArray;
      firstWeapon = firstWeaponRaw;
      secondWeapon = secondWeaponRaw;
    } catch {
      charName = charName === "" ? notFoundText : charName;
      combatPower = combatPower === "" ? notFoundText : combatPower;
      firstWeapon = firstWeapon === "" ? notFoundText : firstWeapon;
      secondWeapon = secondWeapon === "" ? notFoundText : secondWeapon;
    }

    // Log the extracted values
    console.log(`Name: ${charName}`);
    console.log(`Combat Power: ${combatPower}`);
    console.log(`First Weapon: ${firstWeapon}`);
    console.log(`Second Weapon: ${secondWeapon}`);
    console.log(`Build Link: ${buildLink}`);

    buildsData.push([
      charName,
      combatPower,
      firstWeapon,
      secondWeapon,
      buildLink,
    ]);
  }
  await browser.close();

  // Load the service account key file
  const credentials = JSON.parse(
    await fs.readFile("./serviceAccountCredentials.json", "utf8")
  );

  // Authenticate using the service account
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"], // Ensure this is correct
  });

  // Use the authenticated client
  const sheets = google.sheets({ version: "v4", auth });

  async function updateGoogleSheet() {
    // Replace with your Google Sheet ID
    const spreadsheetId = sheetId;

    try {
      // Update values in the first column of the first sheet
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: "CombatPower!A1:E999", // First 3 rows, columns A to C
        valueInputOption: "RAW",
        requestBody: {
          values: buildsData, // Each inner array represents a row
        },
      });

      console.log("Cells updated successfully!");
    } catch (error) {
      console.error("Error updating the sheet:", error);
    }
  }

  updateGoogleSheet();
})();
