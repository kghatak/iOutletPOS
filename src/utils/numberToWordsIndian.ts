function numberToWordsIndian(num: number): string {
  if (typeof num !== "number") num = parseFloat(num as unknown as string);
  if (isNaN(num)) return "";

  const a = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
    "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const units = ["", "Thousand", "Lakh", "Crore"];

  function numToWords(n: number): string {
    if (n < 20) return a[n];
    if (n < 100) return b[Math.floor(n / 10)] + (n % 10 ? " " + a[n % 10] : "");
    if (n < 1000) return a[Math.floor(n / 100)] + " Hundred" + (n % 100 ? " " + numToWords(n % 100) : "");
    return "";
  }

  function intToWords(n: number): string {
    let str = "";
    let i = 0;
    while (n > 0) {
      const divider = i === 0 ? 1000 : 100;
      const chunk = n % divider;
      if (chunk) {
        str = numToWords(chunk) + (units[i] ? " " + units[i] : "") + (str ? " " + str : "");
      }
      n = Math.floor(n / divider);
      i++;
    }
    return str.trim();
  }

  const [rupees, paise] = num.toFixed(2).split(".");
  let words = parseInt(rupees, 10) === 0 ? "Zero" : intToWords(parseInt(rupees, 10));
  let result = words ? words + " Only" : "";
  if (parseInt(paise, 10) > 0) {
    result = words + " and Paisa " + intToWords(parseInt(paise, 10)) + " Only";
  }
  return result;
}

export default numberToWordsIndian;
