export interface IndianCityPincodeEntry {
  city: string;
  pincode: string;
}

export const INDIAN_STATES: string[] = [
  "Andaman & Nicobar Islands",
  "Andhra Pradesh",
  "Andhra Pradesh (New)",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chandigarh",
  "Chhattisgarh",
  "Dadra & Nagar Haveli",
  "Daman & Diu",
  "Delhi",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jammu & Kashmir",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Ladakh",
  "Lakshadweep",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Puducherry",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal"
];

export const INDIAN_STATE_CITY_PIN_DATA: Record<string, IndianCityPincodeEntry[]> = {
  "Andaman & Nicobar Islands": [
    { city: "Port Blair", pincode: "744101" },
    { city: "Havelock Island", pincode: "744211" },
    { city: "Neil Island", pincode: "744104" }
  ],
  "Andhra Pradesh": [
    { city: "Visakhapatnam", pincode: "530001" },
    { city: "Vijayawada", pincode: "520001" },
    { city: "Guntur", pincode: "522001" },
    { city: "Rajahmundry", pincode: "533101" },
    { city: "Tirupati", pincode: "517501" },
    { city: "Kurnool", pincode: "518001" },
    { city: "Anantapur", pincode: "515001" },
    { city: "Nellore", pincode: "524001" }
  ],
  "Andhra Pradesh (New)": [
    { city: "Amaravati", pincode: "522002" },
    { city: "Tadepalligudem", pincode: "534101" },
    { city: "Kakinada", pincode: "533001" },
    { city: "Kadapa", pincode: "516001" }
  ],
  "Arunachal Pradesh": [
    { city: "Itanagar", pincode: "791111" },
    { city: "Naharlagun", pincode: "791110" },
    { city: "Tawang", pincode: "790104" },
    { city: "Pasighat", pincode: "791103" }
  ],
  Assam: [
    { city: "Guwahati", pincode: "781001" },
    { city: "Silchar", pincode: "788001" },
    { city: "Dibrugarh", pincode: "786001" },
    { city: "Jorhat", pincode: "785001" },
    { city: "Tezpur", pincode: "784001" }
  ],
  Bihar: [
    { city: "Patna", pincode: "800001" },
    { city: "Gaya", pincode: "823001" },
    { city: "Muzaffarpur", pincode: "842001" },
    { city: "Bhagalpur", pincode: "812001" },
    { city: "Purnia", pincode: "854301" },
    { city: "Darbhanga", pincode: "846004" }
  ],
  Chandigarh: [
    { city: "Chandigarh", pincode: "160001" }
  ],
  Chhattisgarh: [
    { city: "Raipur", pincode: "492001" },
    { city: "Bhilai", pincode: "490001" },
    { city: "Durg", pincode: "491001" },
    { city: "Bilaspur", pincode: "495001" },
    { city: "Korba", pincode: "495677" }
  ],
  "Dadra & Nagar Haveli": [
    { city: "Silvassa", pincode: "396230" }
  ],
  "Daman & Diu": [
    { city: "Daman", pincode: "396210" },
    { city: "Diu", pincode: "362520" }
  ],
  Delhi: [
    { city: "New Delhi", pincode: "110001" },
    { city: "Delhi", pincode: "110002" },
    { city: "Dwarka", pincode: "110075" },
    { city: "Rohini", pincode: "110085" },
    { city: "Saket", pincode: "110017" }
  ],
  Goa: [
    { city: "Panaji", pincode: "403001" },
    { city: "Margao", pincode: "403601" },
    { city: "Mapusa", pincode: "403507" },
    { city: "Vasco da Gama", pincode: "403802" }
  ],
  Gujarat: [
    { city: "Ahmedabad", pincode: "380001" },
    { city: "Surat", pincode: "395001" },
    { city: "Rajkot", pincode: "360001" },
    { city: "Vadodara", pincode: "390001" },
    { city: "Bhavnagar", pincode: "364001" },
    { city: "Junagadh", pincode: "362001" }
  ],
  Haryana: [
    { city: "Faridabad", pincode: "121001" },
    { city: "Gurugram", pincode: "122001" },
    { city: "Panipat", pincode: "132103" },
    { city: "Ambala", pincode: "133001" },
    { city: "Rohtak", pincode: "124001" }
  ],
  "Himachal Pradesh": [
    { city: "Shimla", pincode: "171001" },
    { city: "Mandi", pincode: "175001" },
    { city: "Dharamshala", pincode: "176215" },
    { city: "Kullu", pincode: "175101" }
  ],
  "Jammu & Kashmir": [
    { city: "Srinagar", pincode: "190001" },
    { city: "Jammu", pincode: "180001" },
    { city: "Anantnag", pincode: "192101" },
    { city: "Baramulla", pincode: "193101" }
  ],
  Jharkhand: [
    { city: "Ranchi", pincode: "834001" },
    { city: "Jamshedpur", pincode: "831001" },
    { city: "Dhanbad", pincode: "826001" },
    { city: "Bokaro", pincode: "827001" }
  ],
  Karnataka: [
    { city: "Bangalore", pincode: "560001" },
    { city: "Mysuru", pincode: "570001" },
    { city: "Hubballi", pincode: "580020" },
    { city: "Mangaluru", pincode: "575001" },
    { city: "Belagavi", pincode: "590001" },
    { city: "Kalaburagi", pincode: "585101" }
  ],
  Kerala: [
    { city: "Thiruvananthapuram", pincode: "695001" },
    { city: "Kochi", pincode: "682001" },
    { city: "Kozhikode", pincode: "673001" },
    { city: "Thrissur", pincode: "680001" },
    { city: "Kannur", pincode: "670001" }
  ],
  Ladakh: [
    { city: "Leh", pincode: "194101" },
    { city: "Kargil", pincode: "194103" }
  ],
  Lakshadweep: [
    { city: "Kavaratti", pincode: "682555" }
  ],
  "Madhya Pradesh": [
    { city: "Bhopal", pincode: "462001" },
    { city: "Indore", pincode: "452001" },
    { city: "Jabalpur", pincode: "482001" },
    { city: "Gwalior", pincode: "474001" },
    { city: "Ujjain", pincode: "456001" }
  ],
  Maharashtra: [
    { city: "Mumbai", pincode: "400001" },
    { city: "Pune", pincode: "411001" },
    { city: "Nagpur", pincode: "440001" },
    { city: "Nashik", pincode: "422001" },
    { city: "Aurangabad", pincode: "431001" },
    { city: "Kolhapur", pincode: "416001" }
  ],
  Manipur: [
    { city: "Imphal", pincode: "795001" },
    { city: "Thoubal", pincode: "795138" },
    { city: "Ukhrul", pincode: "795142" }
  ],
  Meghalaya: [
    { city: "Shillong", pincode: "793001" },
    { city: "Tura", pincode: "794001" },
    { city: "Jowai", pincode: "793150" }
  ],
  Mizoram: [
    { city: "Aizawl", pincode: "796001" },
    { city: "Lunglei", pincode: "796701" },
    { city: "Champhai", pincode: "796321" }
  ],
  Nagaland: [
    { city: "Kohima", pincode: "797001" },
    { city: "Dimapur", pincode: "797112" },
    { city: "Mokokchung", pincode: "798601" }
  ],
  Odisha: [
    { city: "Bhubaneswar", pincode: "751001" },
    { city: "Cuttack", pincode: "753001" },
    { city: "Rourkela", pincode: "769001" },
    { city: "Puri", pincode: "752001" },
    { city: "Sambalpur", pincode: "768001" }
  ],
  Punjab: [
    { city: "Ludhiana", pincode: "141001" },
    { city: "Amritsar", pincode: "143001" },
    { city: "Jalandhar", pincode: "144001" },
    { city: "Chandigarh", pincode: "160001" },
    { city: "Patiala", pincode: "147001" }
  ],
  Puducherry: [
    { city: "Puducherry", pincode: "605001" },
    { city: "Karaikal", pincode: "609602" },
    { city: "Mahe", pincode: "673310" }
  ],
  Rajasthan: [
    { city: "Jaipur", pincode: "302001" },
    { city: "Jodhpur", pincode: "342001" },
    { city: "Udaipur", pincode: "313001" },
    { city: "Ajmer", pincode: "305001" },
    { city: "Kota", pincode: "324001" }
  ],
  Sikkim: [
    { city: "Gangtok", pincode: "737101" },
    { city: "Namchi", pincode: "737126" },
    { city: "Mangan", pincode: "737116" }
  ],
  "Tamil Nadu": [
    { city: "Chennai", pincode: "600001" },
    { city: "Coimbatore", pincode: "641001" },
    { city: "Madurai", pincode: "625001" },
    { city: "Salem", pincode: "636001" },
    { city: "Trichy", pincode: "620001" }
  ],
  Telangana: [
    { city: "Hyderabad", pincode: "500001" },
    { city: "Warangal", pincode: "506001" },
    { city: "Nizamabad", pincode: "503001" },
    { city: "Karimnagar", pincode: "505001" }
  ],
  Tripura: [
    { city: "Agartala", pincode: "799001" },
    { city: "Udaipur", pincode: "799120" },
    { city: "Khowai", pincode: "799201" }
  ],
  "Uttar Pradesh": [
    { city: "Lucknow", pincode: "226001" },
    { city: "Kanpur", pincode: "208001" },
    { city: "Varanasi", pincode: "221001" },
    { city: "Agra", pincode: "282001" },
    { city: "Prayagraj", pincode: "211001" },
    { city: "Gorakhpur", pincode: "273001" },
    { city: "Noida", pincode: "201301" },
    { city: "Meerut", pincode: "250001" }
  ],
  Uttarakhand: [
    { city: "Dehradun", pincode: "248001" },
    { city: "Haridwar", pincode: "249401" },
    { city: "Rishikesh", pincode: "249201" },
    { city: "Haldwani", pincode: "263139" }
  ],
  "West Bengal": [
    { city: "Kolkata", pincode: "700001" },
    { city: "Howrah", pincode: "711101" },
    { city: "Durgapur", pincode: "713001" },
    { city: "Asansol", pincode: "713301" },
    { city: "Siliguri", pincode: "734001" }
  ]
};

export const ALL_INDIAN_CITY_OPTIONS = Object.values(INDIAN_STATE_CITY_PIN_DATA)
  .flatMap((items) => items)
  .reduce<Record<string, string>>((acc, item) => {
    if (!acc[item.city]) acc[item.city] = item.pincode;
    return acc;
  }, {});

export const ALL_INDIAN_CITIES: string[] = Object.keys(ALL_INDIAN_CITY_OPTIONS).sort();

export const ALL_INDIAN_PINCODE_OPTIONS = Object.values(INDIAN_STATE_CITY_PIN_DATA)
  .flatMap((items) => items)
  .map((item) => item.pincode)
  .filter((pincode, index, arr) => arr.indexOf(pincode) === index)
  .sort();

export const getCitySuggestionsForState = (stateName: string): string[] => {
  if (!stateName) return Object.keys(ALL_INDIAN_CITY_OPTIONS);
  return (INDIAN_STATE_CITY_PIN_DATA[stateName] || []).map((entry) => entry.city).sort();
};

export const getPincodeSuggestionsForCity = (cityName: string, stateName?: string): string[] => {
  const all = Object.values(INDIAN_STATE_CITY_PIN_DATA).flat();

  if (!cityName && !stateName) return ALL_INDIAN_PINCODE_OPTIONS;

  const filtered = all.filter((entry) => {
    const cityMatches = !cityName || entry.city.toLowerCase() === cityName.toLowerCase() || entry.city.toLowerCase().includes(cityName.toLowerCase());
    const stateMatches = !stateName || entry.city.toLowerCase() === cityName.toLowerCase() && stateName === "" ||
      !stateName ||
      Object.entries(INDIAN_STATE_CITY_PIN_DATA).some(([state, cities]) => state === stateName && cities.some((item) => item.city === entry.city));
    return cityMatches && stateMatches;
  });

  if (filtered.length > 0) return filtered.map((item) => item.pincode).filter((pincode, index, arr) => arr.indexOf(pincode) === index);

  return ALL_INDIAN_PINCODE_OPTIONS.filter((pincode) => pincode.startsWith(cityName.slice(0, 2) || ""));
};
