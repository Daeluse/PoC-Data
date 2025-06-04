import fs from "fs";
import data from "./data.json" with { type: "json" };

interface Compound {
    description: string;
    referenceDrug: string;
    referenceStandard: string;
    brandName: string;
    genericNames: string[];
    activeIngredients: { name: string, strength: string }[];
    dosageForm: string;
    dosageRoute: string;
    availability: string;
    teCode: string;
    ndc: string;
    applicationNumber: string;
}

const compounds: Compound[] = [];

(data as any).results.forEach((element: any) => {
    const openFda = element["openfda"];

    // Do not aggregate products that are not represented by openFDA
    if (openFda == null || Object.keys(openFda).length === 0) { return; }

    // Generate compound records
    compounds.push(...generateCompoundsFromSource(element));
});

createFile("drugs.json", JSON.stringify(compounds));

function generateCompoundsFromSource(source: any): Compound[] {
    const applicationNumber = source["application_number"];
    const sponsorName = source["sponsor_name"];
    const openFda = source["openfda"];
    const products = source["products"] ?? [];

    const cmpnds: Compound[] = [];

    products.forEach((product: any, idx: number) => {
        const compoundInLocalCollection = cmpnds.find((compound) => {
            const brandNameMatch = compound.brandName === product["brand_name"];
            const activeIngredientMatch = JSON.stringify(compound.activeIngredients) === JSON.stringify(product["active_ingredients"]);
            return brandNameMatch && activeIngredientMatch;
        });
        const compoundInGlobalCollection = compounds.find((compound) => {
            const brandNameMatch = compound.brandName === product["brand_name"];
            const activeIngredientMatch = JSON.stringify(compound.activeIngredients) === JSON.stringify(product["active_ingredients"]);
            return brandNameMatch && activeIngredientMatch;
        });
        const compoundUnavailable = product["marketing_status"] === "Discontinued" || product["marketing_status"] === "None (Tentative Approval)";

        if (compoundInGlobalCollection || compoundInLocalCollection || compoundUnavailable) {
            return;
        }

        const genericNames = openFda["generic_name"].filter((name: string) => name !== product["brand_name"]);

        cmpnds.push({
            activeIngredients: product["active_ingredients"],
            applicationNumber: source["application_number"],
            availability: product["marketing_status"],
            brandName: product["brand_name"],
            description: generateDescription(source, product, genericNames),
            dosageForm: product["dosage_form"],
            dosageRoute: product["route"],
            genericNames,
            ndc: openFda["product_ndc"][idx],
            referenceDrug: product["reference_drug"],
            referenceStandard: product["reference_standard"],
            teCode: product["te_code"],
        });
    });

    return cmpnds;
}

function createFile(fileName: string, data: string) {
    const root = process.cwd();
    if (!fs.existsSync(`${root}/dist`)) {
        fs.mkdirSync(`${root}/dist`);
    }
    if (fs.existsSync(`${root}/dist/${fileName}`)) {
        fs.rmSync(`${root}/dist/${fileName}`);
    }
    fs.writeFileSync(`${root}/dist/${fileName}`, data);
}

function generateDescription(source: any, product: any, generics: string[]): string {
    const ingredients = product["active_ingredients"].reduce((acc: string[], curr: any) => {
        acc.push(`${curr.name} with a strength of ${curr.strength}`);
        return acc;
    }, []);

    const generic = generics.reduce((acc: string, curr: string, idx: number, arr: string[]) => {
        if (idx === 0) {
            acc = curr;
        } else if (idx === arr.length - 1) {
            acc = `${acc} and ${curr}`;
        } else {
            acc = `${acc}, ${curr},`;
        }
        return acc;
    }, "");

    const meta = `${product["brand_name"]} is a ${product["route"]} medication in ${product["dosage_form"]} form.`;
    const mix = `It contains the following ingredients: ${ingredients.join(", ")}.`;
    const alt = generic !== "" ? `This drug is also referred to generically as ${generic}.` : "";

    return `${meta} ${mix} ${alt}`;
}