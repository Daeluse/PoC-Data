import fs from "fs";
import data from "./data.json" with { type: "json" };

interface Drug {
    sponsors: string[];
    applications: string[];
    brands: string[];
    generics: string[];
    manufacturers: string[];
    ndcCodes: string[];
    forms: DrugForm[];
}

interface DrugForm {
    name: string;
    route: string;
    dosageForm: string;
    availability: string;
    teCode: string;
    activeIngredients: { name: string, strength: string }[];
}

const drugs: Drug[] = [];

(data as any).results.forEach((element: any) => {
    const openFda = element["openfda"];

    // Do not aggregate products that are not represented by openFDA
    if (openFda == null || Object.keys(openFda).length === 0) { return; }

    // Generate a record for the Drug
    const drug = generateDrugFromSource(element);

    // Use generic name for de-duplication
    const generics = openFda["generic_name"];

    const existingDrugIndex = drugs.findIndex((drug) => {
        return drug.generics.includes(generics);
    });
    if (existingDrugIndex >= 0) {
        const existingDrug = drugs[existingDrugIndex];
        if (existingDrug?.generics !== generics) {
            console.log("Generics do not match!");
            return;
        }
        const mergedDrug = merge(existingDrug, drug);
        drugs[existingDrugIndex] = mergedDrug;
        return;
    }
    drugs.push(drug);
});

const root = process.cwd();
if (!fs.existsSync(`${root}/dist`)) {
    fs.mkdirSync(`${root}/dist`);
}
if (fs.existsSync(`${root}/dist/drugs.json`)) {
    fs.rmSync(`${root}/dist/drugs.json`);
}
fs.writeFileSync(`${root}/dist/drugs.json`, JSON.stringify(drugs));

function merge(a: Drug, b: Drug): Drug {
    function mergeArray<T>(a: T[], b: T[]): T[] {
        return [...new Set([...a, ...b])]
    }

    return {
        sponsors: mergeArray(a.sponsors, b.sponsors),
        applications: mergeArray(a.applications, b.applications),
        brands: mergeArray(a.brands, b.brands),
        generics: mergeArray(a.generics, b.generics),
        manufacturers: mergeArray(a.manufacturers, b.manufacturers),
        ndcCodes: mergeArray(a.ndcCodes, b.ndcCodes),
        forms: mergeArray(a.forms, b.forms),
    }
}

function generateDrugFromSource(source: any): Drug {
    const applicationNumber = source["application_number"];
    const sponsorName = source["sponsor_name"];
    const openFda = source["openfda"];
    const products = source["products"] ?? [];

    const forms = products.reduce((acc: DrugForm[], curr: any) => {
        const form: DrugForm = {
            name: curr["brand_name"],
            route: curr["route"],
            dosageForm: curr["dosage_form"],
            availability: curr["marketing_status"],
            teCode: curr["te_code"],
            activeIngredients: curr["active_ingredients"],
        };
        acc.push(form);
        return acc;
    }, [] as DrugForm[])

    return {
        sponsors: [sponsorName],
        applications: [applicationNumber],
        brands: openFda["brand_name"] ?? [],
        generics: openFda["generic_name"] ?? [],
        manufacturers: openFda["manufacturer_name"] ?? [],
        ndcCodes: openFda["package_ndc"] ?? [],
        forms,
    }
}