const fs = require("fs");

// Function to parse CSV line while handling quoted fields
function parseCSVLine(line) {
	const columns = [];
	let current = "";
	let inQuotes = false;

	for (let i = 0; i < line.length; i++) {
		const char = line[i];

		if (char === '"') {
			inQuotes = !inQuotes;
			current += char;
		} else if (char === "," && !inQuotes) {
			columns.push(current);
			current = "";
		} else {
			current += char;
		}
	}
	columns.push(current); // Add the last column
	return columns;
}

// Function to clean quotes from field
function cleanField(field) {
	if (!field) return "";
	return field.replace(/"/g, "").trim();
}

// Function to create manager mapping
function getManagerMapping(csvData) {
	const lines = csvData.split("\n");
	const header = parseCSVLine(lines[0]);

	console.log("CSV Header:", header);
	console.log("Total columns:", header.length);

	const employeeMap = new Map();
	const managerMapping = {
		employees: {},
		managers: {},
		managerHierarchy: {},
	};

	// First pass: Create employee map
	for (let i = 1; i < lines.length; i++) {
		if (lines[i].trim() === "") continue;

		const columns = parseCSVLine(lines[i]);
		if (columns.length < 10) continue;

		const employee = {
			sno: cleanField(columns[0]),
			id: cleanField(columns[1]),
			fullName: cleanField(columns[2]),
			emailId: cleanField(columns[5]),
			empId: cleanField(columns[6]),
			designation: cleanField(columns[8]),
			manager: cleanField(columns[9]),
			department: cleanField(columns[10]),
		};

		employeeMap.set(employee.emailId, employee);
		managerMapping.employees[employee.emailId] = employee;
	}

	// Second pass: Create manager relationships
	for (const [emailId, employee] of employeeMap) {
		if (employee.manager && employee.manager !== "") {
			// Find manager details
			const managerEmployee = employeeMap.get(employee.manager);

			if (managerEmployee) {
				// Manager exists in our system
				if (!managerMapping.managers[employee.manager]) {
					managerMapping.managers[employee.manager] = {
						managerInfo: managerEmployee,
						reportees: [],
					};
				}
				managerMapping.managers[employee.manager].reportees.push(employee);

				managerMapping.managerHierarchy[emailId] = {
					employee: employee,
					managerEmail: employee.manager,
					managerInfo: managerEmployee,
				};
			} else {
				// Manager email not found in employee list (external or missing)
				managerMapping.managerHierarchy[emailId] = {
					employee: employee,
					managerEmail: employee.manager,
					managerInfo: null, // External manager
				};
			}
		}
	}

	return managerMapping;
}

// Function to create email mapping (old email -> new email)
function createEmailMapping(csvData) {
	const lines = csvData.split("\n");
	const emailMapping = new Map();

	for (let i = 1; i < lines.length; i++) {
		if (lines[i].trim() === "") continue;

		const columns = parseCSVLine(lines[i]);
		if (columns.length < 6) continue;

		const oldEmail = cleanField(columns[5]);
		const sno = cleanField(columns[0]);
		const newEmail = `aarohan.b+${sno}@surveysparrow.com`;

		if (oldEmail && oldEmail !== "") {
			emailMapping.set(oldEmail, newEmail);
		}
	}

	return emailMapping;
}

// Function to update email with new format
function updateEmail(email, sno) {
	if (!email || email === '""' || email.trim() === "") {
		return email;
	}
	return `"aarohan.b+${sno}@surveysparrow.com"`;
}

// Function to update manager email using email mapping
function updateManagerEmail(managerEmail, emailMapping) {
	if (!managerEmail || managerEmail === '""' || managerEmail.trim() === "") {
		return managerEmail;
	}

	const cleanManagerEmail = cleanField(managerEmail);
	const newManagerEmail = emailMapping.get(cleanManagerEmail);

	if (newManagerEmail) {
		return `"${newManagerEmail}"`;
	}

	// If manager not found in mapping, keep original
	return managerEmail;
}

// Read the CSV file
const inputFile = "/Users/eswar/Downloads/employee-2676 (1).csv";
const outputFile = "/Users/eswar/Downloads/employee-2676-updated-aarohan.csv";

try {
	console.log("📂 Reading CSV file...");
	const data = fs.readFileSync(inputFile, "utf8");

	console.log("🔍 Parsing and creating manager mapping...");
	const managerMapping = getManagerMapping(data);

	console.log("🗺️ Creating email mapping...");
	const emailMapping = createEmailMapping(data);

	// Display statistics
	console.log("\n📊 Manager Mapping Statistics:");
	console.log(
		`Total employees: ${Object.keys(managerMapping.employees).length}`,
	);
	console.log(`Total managers: ${Object.keys(managerMapping.managers).length}`);
	console.log(
		`Employees with managers: ${Object.keys(managerMapping.managerHierarchy).length}`,
	);
	console.log(`Email mappings created: ${emailMapping.size}`);

	// Show some examples of email mapping
	console.log("\n📧 Email Mapping Examples:");
	let count = 0;
	for (const [oldEmail, newEmail] of emailMapping) {
		if (count >= 5) break;
		console.log(`${oldEmail} → ${newEmail}`);
		count++;
	}

	// Show manager-reportee relationship examples with new emails
	console.log("\n👥 Manager-Reportee Examples (with new emails):");
	count = 0;
	for (const [managerEmail, managerData] of Object.entries(
		managerMapping.managers,
	)) {
		if (count >= 3) break;
		const newManagerEmail = emailMapping.get(managerEmail) || managerEmail;
		console.log(`\n👨‍💼 Manager: ${managerData.managerInfo.fullName}`);
		console.log(`   📧 Old Email: ${managerEmail}`);
		console.log(`   📧 New Email: ${newManagerEmail}`);
		console.log(`   👥 Reportees (${managerData.reportees.length}):`);
		managerData.reportees.slice(0, 2).forEach((reportee) => {
			const newReporteeEmail =
				emailMapping.get(reportee.emailId) || reportee.emailId;
			console.log(
				`      - ${reportee.fullName}: ${reportee.emailId} → ${newReporteeEmail}`,
			);
		});
		count++;
	}

	// Process CSV and update emails
	console.log("\n🔄 Processing CSV and updating emails...");
	const lines = data.split("\n");
	const updatedLines = lines.map((line, index) => {
		if (index === 0) {
			// Keep header as is
			return line;
		}

		if (line.trim() === "") {
			return line;
		}

		const columns = parseCSVLine(line);
		if (columns.length < 10) return line;

		const sno = cleanField(columns[0]);

		// Update emailId (column 5)
		columns[5] = updateEmail(columns[5], sno);

		// Update manager email (column 9) using email mapping
		columns[9] = updateManagerEmail(columns[9], emailMapping);

		return columns.join(",");
	});

	// Write updated CSV
	fs.writeFileSync(outputFile, updatedLines.join("\n"));
	console.log(`\n✅ Updated CSV saved to: ${outputFile}`);
	console.log(`Total lines processed: ${updatedLines.length - 1}`);

	// Save the mapping to a JSON file for reference
	const mappingFile = "/Users/eswar/Downloads/manager-mapping.json";
	const emailMappingFile = "/Users/eswar/Downloads/email-mapping.json";

	fs.writeFileSync(mappingFile, JSON.stringify(managerMapping, null, 2));
	fs.writeFileSync(
		emailMappingFile,
		JSON.stringify(Object.fromEntries(emailMapping), null, 2),
	);

	console.log(`\n💾 Manager mapping saved to: ${mappingFile}`);
	console.log(`💾 Email mapping saved to: ${emailMappingFile}`);
} catch (error) {
	console.error("❌ Error processing file:", error.message);
}