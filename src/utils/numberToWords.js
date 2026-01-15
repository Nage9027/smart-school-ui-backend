const units = [
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
  ];
  const teens = [
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
  ];
  const tens = [
    "",
    "",
    "Twenty",
    "Thirty",
    "Forty",
    "Fifty",
    "Sixty",
    "Seventy",
    "Eighty",
    "Ninety",
  ];
  
  const convertLessThanThousand = (n) => {
    if (n === 0) return "";
  
    let result = "";
  
    // Hundreds
    if (n >= 100) {
      result += units[Math.floor(n / 100)] + " Hundred ";
      n %= 100;
    }
  
    // Tens and units
    if (n >= 20) {
      result += tens[Math.floor(n / 10)] + " ";
      n %= 10;
    } else if (n >= 10) {
      result += teens[n - 10] + " ";
      return result;
    }
  
    // Units
    if (n > 0) {
      result += units[n] + " ";
    }
  
    return result;
  };
  
  export const convertToWords = (num) => {
    if (num === 0) return "Zero Rupees Only";
    if (num < 0) return "Minus " + convertToWords(Math.abs(num));
  
    let result = "";
    let number = Math.floor(num);
  
    // Handle decimal part (paise)
    const decimalPart = Math.round((num - Math.floor(num)) * 100);
  
    // Crores
    if (number >= 10000000) {
      result += convertLessThanThousand(Math.floor(number / 10000000)) + "Crore ";
      number %= 10000000;
    }
  
    // Lakhs
    if (number >= 100000) {
      result += convertLessThanThousand(Math.floor(number / 100000)) + "Lakh ";
      number %= 100000;
    }
  
    // Thousands
    if (number >= 1000) {
      result += convertLessThanThousand(Math.floor(number / 1000)) + "Thousand ";
      number %= 1000;
    }
  
    // Hundreds
    result += convertLessThanThousand(number);
  
    // Remove trailing space and add 'Rupees'
    result = result.trim();
    if (result) {
      result += " Rupees";
    }
  
    // Add paise if any
    if (decimalPart > 0) {
      if (result) result += " and ";
      result += convertLessThanThousand(decimalPart) + "Paise";
    }
  
    return result + " Only";
  };