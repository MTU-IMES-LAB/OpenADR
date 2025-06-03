module.exports = function (RED) {
	// Import required modules
	const xpath = require('xpath');
	const dom = require('xmldom').DOMParser;
	const request = require('request');
	const fs = require('fs');
	const libxmljs = require('libxmljs2'); // npm install libxmljs2

	function OpenADR(config) {
		RED.nodes.createNode(this, config);
		const node = this;
		node.name = config.name;
		node.url = config.url;
		node.rate = config.rate;
		node.ven_id = config.ven_id;
		node.profile = config.ven_profile;

		let timerID;

		// SSL options for secure requests
		const sslOptions = {
			cert: config.cert ? fs.readFileSync(config.cert) : undefined,
			key: config.key ? fs.readFileSync(config.key) : undefined,
			ca: config.ca ? fs.readFileSync(config.ca) : undefined,
			rejectUnauthorized: config.rejectUnauthorized !== false // default true
		};

		// Handle input messages (optIn/optOut)
		node.on('input', function (msg) {
			const optmsg = msg.payload;
			const xsdPath = __dirname + '/schemas/oadr-2_0b.xsd';
			// Validate outgoing opt XML
			if (!validateXML(optmsg, xsdPath)) {
				node.error("Outgoing opt XML failed schema validation");
				node.status({ fill: "red", shape: "dot", text: "Schema validation failed" });
				return;
			}
			// Send optIn/optOut XML to VTN
			request({
				url: node.url + '/OpenADR2/Simple/2.0b/EiOpt',
				method: "POST",
				headers: { "content-type": "application/xml" },
				body: optmsg,
				...sslOptions
			}, function (error, response, body) {
				// Network or request error
				if (error) {
					node.error("Network error: " + error.message, { error });
					node.status({ fill: "red", shape: "ring", text: "Network error" });
					return;
				}
				// HTTP error status
				if (!response || response.statusCode < 200 || response.statusCode >= 300) {
					node.error(`HTTP error: ${response ? response.statusCode : 'No response'}`, { statusCode: response && response.statusCode, body });
					node.status({ fill: "red", shape: "dot", text: `HTTP ${response ? response.statusCode : 'ERR'}` });
					return;
				}
				// Empty or malformed response
				if (!body) {
					node.error("Empty response from VTN");
					node.status({ fill: "yellow", shape: "ring", text: "Empty response" });
					return;
				}
				// XML schema validation
				if (!validateXML(body, xsdPath)) {
					node.error("Incoming opt response XML failed schema validation");
					node.status({ fill: "red", shape: "dot", text: "Schema validation failed" });
					return;
				}
				// Log exchanges for opt messages
				if (optmsg.includes("oadrCreateOpt")) {
					logExchange("oadrCreateOpt", optmsg, "oadrCreatedOpt", body);
				} else if (optmsg.includes("oadrCancelOpt")) {
					logExchange("oadrCancelOpt", optmsg, "oadrCanceledOpt", body);
				}
				node.status({ fill: "green", shape: "dot", text: "Opt success" });
			});
		});

		// Registration XML for 2.0b
		const myXMLregistration2b = `<?xml version="1.0" encoding="utf-8"?>
<oadrPayload xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns="http://openadr.org/oadr-2.0b/2012/07">
  <oadrSignedObject>
	<oadrCreatePartyRegistration d3p1:schemaVersion="2.0b" xmlns:d3p1="http://docs.oasis-open.org/ns/energyinterop/201110">
	  <requestID xmlns="http://docs.oasis-open.org/ns/energyinterop/201110/payloads">50004</requestID>
	  <d3p1:venID>${node.ven_id}</d3p1:venID>
	  <oadrVenName>${node.name}</oadrVenName>
	  <oadrProfileName>2.0b</oadrProfileName>
	  <oadrTransportName>simpleHttp</oadrTransportName>
	  <oadrTransportAddress />
	  <oadrReportOnly>false</oadrReportOnly>
	  <oadrXmlSignature>false</oadrXmlSignature>
	  <oadrHttpPullModel>true</oadrHttpPullModel>
	</oadrCreatePartyRegistration>
  </oadrSignedObject>
</oadrPayload>`;

		// Main logic: start polling or registration based on profile
		if (node.profile === 'A') {
			// For 2.0a, poll for events at interval
			timerID = setInterval(() => {
				node.status({ fill: "green", shape: "dot", text: "Requesting" });
				requestevent();
			}, node.rate * 1000 + Math.random());
		} else {
			// For 2.0b, start registration process
			oadrQueryRegistration();
		}

		// --- Helper Functions ---

		// Log request/response exchanges for debugging
		function logExchange(reqType, reqBody, resType, resBody) {
			console.log(`\n VEN ------------${reqType}--------------> VTN \n`);
			console.log(new Date().toISOString());
			console.log(reqBody);
			console.log(`\n VTN ------------${resType}--------------> VEN \n`);
			console.log(new Date().toISOString());
			console.log(resBody);
		}

		// 2.0a: Request event from VTN
		function requestevent() {
			const myXMLrequesteventa = `<oadr:oadrRequestEvent xmlns:ei="http://docs.oasis-open.org/ns/energyinterop/201110" xmlns:emix="http://docs.oasis-open.org/ns/emix/2011/06" xmlns:oadr="http://openadr.org/oadr-2.0a/2012/07" xmlns:pyld="http://docs.oasis-open.org/ns/energyinterop/201110/payloads" xmlns:strm="urn:ietf:params:xml:ns:icalendar-2.0:stream" xmlns:xcal="urn:ietf:params:xml:ns:icalendar-2.0">
  <pyld:eiRequestEvent>
    <ei:requestID/>
    <ei:venID>${node.ven_id}</ei:venID>
    <pyld:replyLimit>99</pyld:eiRequestEvent>
</oadr:oadrRequestEvent>`;
			const xsdPath = __dirname + '/schemas/oadr-2_0a.xsd';
			// Validate outgoing 2.0a request event XML
			if (!validateXML(myXMLrequesteventa, xsdPath)) {
				node.error("Outgoing 2.0a request event XML failed schema validation");
				node.status({ fill: "red", shape: "dot", text: "Schema validation failed" });
				return;
			}
			// Send request event XML
			request({
				url: node.url + '/OpenADR2/Simple/EiEvent',
				method: "POST",
				headers: { "content-type": "application/xml" },
				body: myXMLrequesteventa,
				...sslOptions
			}, function (error, response, body) {
				// Network or request error
				if (error) {
					node.error("Network error: " + error.message, { error });
					node.status({ fill: "red", shape: "ring", text: "Network error" });
					return;
				}
				// HTTP error status
				if (!response || response.statusCode < 200 || response.statusCode >= 300) {
					node.error(`HTTP error: ${response ? response.statusCode : 'No response'}`, { statusCode: response && response.statusCode, body });
					node.status({ fill: "red", shape: "dot", text: `HTTP ${response ? response.statusCode : 'ERR'}` });
					return;
				}
				// Empty or malformed response
				if (!body) {
					node.error("Empty response from VTN");
					node.status({ fill: "yellow", shape: "ring", text: "Empty response" });
					return;
				}
				// XML schema validation
				if (!validateXML(body, xsdPath)) {
					node.error("Incoming 2.0a event response failed schema validation");
					node.status({ fill: "red", shape: "dot", text: "Schema validation failed" });
					return;
				}
				node.status({ fill: "green", shape: "dot", text: "Event received" });
				node.send({ payload: body });
			});
		}

		// 2.0b: Send registration XML to VTN
		function oadrCreatePartyRegistration(xml) {
			const xsdPath = __dirname + '/schemas/oadr-2_0b.xsd';
			// Validate outgoing XML
			if (!validateXML(xml, xsdPath)) {
				node.error("Outgoing registration XML failed schema validation");
				node.status({ fill: "red", shape: "dot", text: "Schema validation failed" });
				return;
			}
			request({
				url: node.url + '/OpenADR2/Simple/2.0b/EiRegisterParty',
				method: "POST",
				headers: { "content-type": "application/xml" },
				body: xml,
				...sslOptions
			}, function (error, response, body) {
				if (error) {
					node.error("Network error: " + error.message, { error });
					node.status({ fill: "red", shape: "ring", text: "Network error" });
					return;
				}
				if (!response || response.statusCode < 200 || response.statusCode >= 300) {
					node.error(`HTTP error: ${response ? response.statusCode : 'No response'}`, { statusCode: response && response.statusCode, body });
					node.status({ fill: "red", shape: "dot", text: `HTTP ${response ? response.statusCode : 'ERR'}` });
					return;
				}
				if (!body) {
					node.error("Empty response from VTN");
					node.status({ fill: "yellow", shape: "ring", text: "Empty response" });
					return;
				}
				if (!validateXML(body, xsdPath)) {
					node.error("Incoming registration response failed schema validation");
					node.status({ fill: "red", shape: "dot", text: "Schema validation failed" });
					return;
				}
				logExchange("oadrCreatePartyRegistration", xml, "oadrCreatedPartyRegistration", body);

				const doc = new dom().parseFromString(body);
				const registrationID = getText(doc, 'registrationID');
				const ven_ID = getText(doc, 'venID');
				console.log("Registration ID is " + registrationID);
				console.log("VEN ID is " + ven_ID);

				oadrPoll(ven_ID, registrationID);
				setTimeout(() => requestevent2(ven_ID), 500);

				timerID = setInterval(() => {
					node.status({ fill: "green", shape: "dot", text: "Requesting" });
					oadrPoll(ven_ID, registrationID);
				}, node.rate * 1000 + Math.random());
				node.status({ fill: "green", shape: "dot", text: "Registration success" });
			});
		}

		// 2.0b: Query registration before registering
		function oadrQueryRegistration() {
			const myXMLQueryRegistration = `<?xml version="1.0" encoding="utf-8"?>
<oadrPayload xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns="http://openadr.org/oadr-2.0b/2012/07">
  <oadrSignedObject>
	<oadrQueryRegistration d3p1:schemaVersion="2.0b" xmlns:d3p1="http://docs.oasis-open.org/ns/energyinterop/201110">
	  <requestID xmlns="http://docs.oasis-open.org/ns/energyinterop/201110/payloads">f6fe9f8aa5</requestID>
	</oadrQueryRegistration>
  </oadrSignedObject>
</oadrPayload>`;
			const xsdPath = __dirname + '/schemas/oadr-2_0b.xsd';
			// Validate outgoing query registration XML
			if (!validateXML(myXMLQueryRegistration, xsdPath)) {
				node.error("Outgoing query registration XML failed schema validation");
				node.status({ fill: "red", shape: "dot", text: "Schema validation failed" });
				return;
			}
			request({
				url: node.url + '/OpenADR2/Simple/2.0b/EiRegisterParty',
				method: "POST",
				headers: { "content-type": "application/xml" },
				body: myXMLQueryRegistration,
				...sslOptions
			}, function (error, response, body) {
				if (error) {
					node.error("Network error: " + error.message, { error });
					node.status({ fill: "red", shape: "ring", text: "Network error" });
					return;
				}
				if (!response || response.statusCode < 200 || response.statusCode >= 300) {
					node.error(`HTTP error: ${response ? response.statusCode : 'No response'}`, { statusCode: response && response.statusCode, body });
					node.status({ fill: "red", shape: "dot", text: `HTTP ${response ? response.statusCode : 'ERR'}` });
					return;
				}
				if (!body) {
					node.error("Empty response from VTN");
					node.status({ fill: "yellow", shape: "ring", text: "Empty response" });
					return;
				}
				if (!validateXML(body, xsdPath)) {
					node.error("Incoming query registration response failed schema validation");
					node.status({ fill: "red", shape: "dot", text: "Schema validation failed" });
					return;
				}
				if ([500, 503].includes(response.statusCode)) {
					node.status({ fill: "yellow", shape: "ring", text: "Retrying registration" });
					return oadrQueryRegistration();
				}
				logExchange("oadrQueryRegistration", myXMLQueryRegistration, "oadrCreatedPartyRegistration", body);
				oadrCreatePartyRegistration(myXMLregistration2b);
				node.status({ fill: "green", shape: "dot", text: "Query registration success" });
			});
		}

		// 2.0b: Poll for events and handle VTN responses
		function oadrPoll(ven_ID, registrationID) {
			const myXMLpoll2b = `<?xml version="1.0" encoding="utf-8"?>
<oadrPayload xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns="http://openadr.org/oadr-2.0b/2012/07">
  <oadrSignedObject>
	<oadrPoll d3p1:schemaVersion="2.0b" xmlns:d3p1="http://docs.oasis-open.org/ns/energyinterop/201110">
	  <d3p1:venID>${ven_ID}</d3p1:venID>
	</oadrPoll>
  </oadrSignedObject>
</oadrPayload>`;
			const xsdPath = __dirname + '/schemas/oadr-2_0b.xsd';
			// Validate outgoing poll XML
			if (!validateXML(myXMLpoll2b, xsdPath)) {
				node.error("Outgoing poll XML failed schema validation");
				node.status({ fill: "red", shape: "dot", text: "Schema validation failed" });
				return;
			}
			request({
				url: node.url + '/OpenADR2/Simple/2.0b/OadrPoll',
				method: "POST",
				headers: { "content-type": "application/xml" },
				body: myXMLpoll2b,
				...sslOptions
			}, function (error, response, body) {
				// Validate incoming poll response XML
				if (body && !validateXML(body, xsdPath)) {
					node.error("Incoming poll response failed schema validation");
					node.status({ fill: "red", shape: "dot", text: "Schema validation failed" });
					return;
				}
				if (!body) return oadrPoll(ven_ID, registrationID);

				// Parse poll response
				const doc = new dom().parseFromString(body);
				const requestID = getText(doc, 'requestID');
				const eventID = getText(doc, 'eventID');
				const modificationNumber = getText(doc, 'modificationNumber');

				// Handle different VTN responses
				if (body.includes("oadrDistributeEvent")) {
					// If response required, send created event
					if (body.includes("oadrResponseRequired>always<")) {
						oadrCreatedEvent(makeCreatedEventXML(requestID, eventID, modificationNumber, ven_ID));
					}
					// Extract signal values and send to Node-RED
					const { array_signalID, array_value } = extractSignalValues(doc);
					node.send({
						payload: body,
						all_data: JSON.stringify({ signalID: array_signalID, CurrentValue: array_value }),
						value: array_value
					});
					logExchange("oadrDistributeEvent", myXMLpoll2b, "oadrDistributeEvent", body);
				} else if (body.includes("oadrResponse")) {
					logExchange("oadrResponse", myXMLpoll2b, "oadrResponse", body);
				} else if (body.includes("oadrRequestRegistration")) {
					logExchange("oadrRequestRegistration", myXMLpoll2b, "oadrRequestRegistration", body);
					oadrCreatePartyRegistration(myXMLregistration2b);
				} else if (body.includes("oadrRegisterReport")) {
					logExchange("oadrRegisterReport", myXMLpoll2b, "oadrRegisterReport", body);
					oadrRegisteredReport(ven_ID);
				} else if (body.includes("oadrCancelPartyRegistration")) {
					logExchange("oadrCancelPartyRegistration", myXMLpoll2b, "oadrCancelPartyRegistration", body);
					oadrCreatePartyRegistration();
				} else if (body.includes("oadrRequestReregistration")) {
					logExchange("oadrRequestReregistration", myXMLpoll2b, "oadrRequestReregistration", body);
					oadrResponse(ven_ID);
					// Prepare reregistration XML
					const myXMLReregistration = `<?xml version="1.0" encoding="utf-8"?>
<oadrPayload xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns="http://openadr.org/oadr-2.0b/2012/07">
  <oadrSignedObject>
	<oadrCreatePartyRegistration d3p1:schemaVersion="2.0b" xmlns:d3p1="http://docs.oasis-open.org/ns/energyinterop/201110">
	  <requestID xmlns="http://docs.oasis-open.org/ns/energyinterop/201110/payloads">50004</requestID>
	  <d3p1:registrationID>${registrationID}</d3p1:registrationID>
	  <d3p1:venID>${node.ven_id}</d3p1:venID>
	  <oadrVenName>${node.name}</oadrVenName>
	  <oadrProfileName>2.0b</oadrProfileName>
	  <oadrTransportName>simpleHttp</oadrTransportName>
	  <oadrTransportAddress />
	  <oadrReportOnly>false</oadrReportOnly>
	  <oadrXmlSignature>false</oadrXmlSignature>
	  <oadrHttpPullModel>true</oadrHttpPullModel>
	</oadrCreatePartyRegistration>
  </oadrSignedObject>
</oadrPayload>`;
					oadrCreatePartyRegistration(myXMLReregistration);
				}
				// Retry on server error
				if (response.statusCode === 500) oadrPoll(ven_ID, registrationID);
			});
		}

		// 2.0b: Request event after registration
		function requestevent2(ven_ID) {
			const myXMLrequesteventb = `<?xml version="1.0" encoding="utf-8"?>
<oadrPayload xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns="http://openadr.org/oadr-2.0b/2012/07">
  <oadrSignedObject>
	<oadrRequestEvent d3p1:schemaVersion="2.0b" xmlns:d3p1="http://docs.oasis-open.org/ns/energyinterop/201110">
	  <eiRequestEvent xmlns="http://docs.oasis-open.org/ns/energyinterop/201110/payloads">
		<requestID></requestID>
		<d3p1:venID>${ven_ID}</d3p1:venID>
	  </eiRequestEvent>
	</oadrRequestEvent>
  </oadrSignedObject>
</oadrPayload>`;
			const xsdPath = __dirname + '/schemas/oadr-2_0b.xsd';
			// Validate outgoing request event XML
			if (!validateXML(myXMLrequesteventb, xsdPath)) {
				node.error("Outgoing request event XML failed schema validation");
				node.status({ fill: "red", shape: "dot", text: "Schema validation failed" });
				return;
			}
			request({
				url: node.url + '/OpenADR2/Simple/2.0b/EiEvent',
				method: "POST",
				headers: { "content-type": "application/xml" },
				body: myXMLrequesteventb,
				...sslOptions
			}, function (error, response, body) {
				// Validate incoming event response XML
				if (body && !validateXML(body, xsdPath)) {
					node.error("Incoming event response failed schema validation");
					node.status({ fill: "red", shape: "dot", text: "Schema validation failed" });
					return;
				}
				if (!body) return requestevent2(ven_ID);
				const doc = new dom().parseFromString(body);
				const requestID = getText(doc, 'requestID');
				const eventID = getText(doc, 'eventID');
				const modificationNumber = getText(doc, 'modificationNumber');
				if (body.includes("oadrDistributeEvent")) {
					// If response required, send created event
					if (body.includes("oadrResponseRequired>always<")) {
						oadrCreatedEvent(makeCreatedEventXML(requestID, eventID, modificationNumber, ven_ID));
					}
					// Extract signal values and send to Node-RED
					const { array_signalID, array_value } = extractSignalValues(doc, true);
					node.send({
						payload: body,
						all_data: JSON.stringify({ signalID: array_signalID, CurrentValue: array_value }),
						value: array_value
					});
					logExchange("oadrDistributeEvent", myXMLrequesteventb, "oadrDistributeEvent", body);
				}
				// Retry on server error
				if ([500, 503].includes(response.statusCode)) requestevent2(ven_ID);
			});
		}

		// 2.0b: Send created event response to VTN
		function oadrCreatedEvent(myXMLcreatedevent) {
			const xsdPath = __dirname + '/schemas/oadr-2_0b.xsd';
			// Validate outgoing created event XML
			if (!validateXML(myXMLcreatedevent, xsdPath)) {
				node.error("Outgoing created event XML failed schema validation");
				node.status({ fill: "red", shape: "dot", text: "Schema validation failed" });
				return;
			}
			request({
				url: node.url + '/OpenADR2/Simple/2.0b/EiEvent',
				method: "POST",
				headers: { "content-type": "application/xml" },
				body: myXMLcreatedevent,
				...sslOptions
			}, function (error, response, body) {
				// Validate incoming created event response XML
				if (body && !validateXML(body, xsdPath)) {
					node.error("Incoming created event response failed schema validation");
					node.status({ fill: "red", shape: "dot", text: "Schema validation failed" });
					return;
				}
				logExchange("oadrCreatedEvent", myXMLcreatedevent, "oadrResponse", body);
				node.status({ fill: "green", shape: "dot", text: "Created event success" });
				// Retry on server error
				if (!body || [500, 503].includes(response.statusCode)) oadrCreatedEvent(myXMLcreatedevent);
			});
		}

		// 2.0b: Send registered report response
		function oadrRegisteredReport(ven_ID) {
			const myXMLregisteredreport = `<?xml version="1.0" encoding="utf-8"?>
<oadrPayload xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns="http://openadr.org/oadr-2.0b/2012/07">
  <oadrSignedObject>
	<oadrRegisteredReport d3p1:schemaVersion="2.0b" xmlns:d3p1="http://docs.oasis-open.org/ns/energyinterop/201110">
	  <d3p1:eiResponse>
		<d3p1:responseCode>200</d3p1:responseCode>
		<d3p1:responseDescription>OK</d3p1:responseDescription>
		<requestID xmlns="http://docs.oasis-open.org/ns/energyinterop/201110/payloads">1e7f5f377168380276ab</requestID>
	  </d3p1:eiResponse>
	  <d3p1:venID>${ven_ID}</d3p1:venID>
	</oadrRegisteredReport>
  </oadrSignedObject>
</oadrPayload>`;
			const xsdPath = __dirname + '/schemas/oadr-2_0b.xsd';
			// Validate outgoing registered report XML
			if (!validateXML(myXMLregisteredreport, xsdPath)) {
				node.error("Outgoing registered report XML failed schema validation");
				node.status({ fill: "red", shape: "dot", text: "Schema validation failed" });
				return;
			}
			request({
				url: node.url + '/OpenADR2/Simple/2.0b/EiReport',
				method: "POST",
				headers: { "content-type": "application/xml" },
				body: myXMLregisteredreport,
				...sslOptions
			}, function (error, response, body) {
				// Validate incoming registered report response XML
				if (body && !validateXML(body, xsdPath)) {
					node.error("Incoming registered report response failed schema validation");
					node.status({ fill: "red", shape: "dot", text: "Schema validation failed" });
					return;
				}
				logExchange("oadrRegisteredReport", myXMLregisteredreport, "oadrResponse", body);
				node.status({ fill: "green", shape: "dot", text: "Registered report success" });
				// Retry on server error
				if (!body || [500, 503].includes(response.statusCode)) oadrRegisteredReport(ven_ID);
			});
		}

		// 2.0b: Send generic oadrResponse
		function oadrResponse(ven_ID) {
			const myXMLresponse = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<ns2:oadrPayload xmlns:ns1="http://docs.oasis-open.org/ns/energyinterop/201110" xmlns:ns2="http://openadr.org/oadr-2.0b/2012/07" xmlns:ns3="http://www.w3.org/2005/Atom" xmlns:ns4="http://docs.oasis-open.org/ns/emix/2011/06/power" xmlns:ns5="http://docs.oasis-open.org/ns/emix/2011/06/siscale" xmlns:ns6="http://www.opengis.net/gml/3.2" xmlns:ns7="http://www.w3.org/2009/xmldsig11#" xmlns:ns8="http://www.w3.org/2000/09/xmldsig#" xmlns:ns9="http://openadr.org/oadr-2.0b/2012/07/xmldsig-properties" xmlns:ns10="urn:ietf:params:xml:ns:icalendar-2.0" xmlns:ns11="http://docs.oasis-open.org/ns/emix/2011/06" xmlns:ns12="http://docs.oasis-open.org/ns/energyinterop/201110/payloads" xmlns:ns13="urn:ietf:params:xml:ns:icalendar-2.0:stream" xmlns:ns14="urn:un:unece:uncefact:codelist:standard:5:ISO42173A:2010-04-07">
  <ns2:oadrSignedObject>
	<ns2:oadrResponse ns1:schemaVersion="2.0b">
	  <ns1:eiResponse>
		<ns1:responseCode>200</ns1:responseCode>
		<ns1:responseDescription>OK</ns1:responseDescription>
		<ns12:requestID></ns12:requestID>
	  </ns1:eiResponse>
	  <ns1:venID>${ven_ID}</ns1:venID>
	</ns2:oadrResponse>
  </ns2:oadrSignedObject>
</ns2:oadrPayload>`;
			const xsdPath = __dirname + '/schemas/oadr-2_0b.xsd';
			// Validate outgoing oadrResponse XML
			if (!validateXML(myXMLresponse, xsdPath)) {
				node.error("Outgoing oadrResponse XML failed schema validation");
				node.status({ fill: "red", shape: "dot", text: "Schema validation failed" });
				return;
			}
			request({
				url: node.url + '/OpenADR2/Simple/2.0b/EiReport',
				method: "POST",
				headers: { "content-type": "application/xml" },
				body: myXMLresponse,
				...sslOptions
			}, function (error, response, body) {
				// Validate incoming oadrResponse response XML
				if (body && !validateXML(body, xsdPath)) {
					node.error("Incoming oadrResponse response failed schema validation");
					node.status({ fill: "red", shape: "dot", text: "Schema validation failed" });
					return;
				}
				logExchange("oadrResponse", myXMLresponse, "http(200)", body);
				node.status({ fill: "green", shape: "dot", text: "oadrResponse success" });
				// Retry on server error
				if (!body || [500, 503].includes(response.statusCode)) oadrResponse(ven_ID);
			});
		}

		// --- Utility Functions ---

		// Extract text value from XML by tag name
		function getText(doc, tag) {
			const node = xpath.select("//*[local-name(.)='" + tag + "']/text()", doc)[0];
			return node ? node.nodeValue : '';
		}

		// Build oadrCreatedEvent XML
		function makeCreatedEventXML(requestID, eventID, modificationNumber, ven_ID) {
			return `<?xml version="1.0" encoding="utf-8"?>
<oadrPayload xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns="http://openadr.org/oadr-2.0b/2012/07">
  <oadrSignedObject>
	<oadrCreatedEvent d3p1:schemaVersion="2.0b" xmlns:d3p1="http://docs.oasis-open.org/ns/energyinterop/201110">
	  <eiCreatedEvent xmlns="http://docs.oasis-open.org/ns/energyinterop/201110/payloads">
		<d3p1:eiResponse>
		  <d3p1:responseCode>200</d3p1:responseCode>
		  <d3p1:responseDescription>OK</d3p1:responseDescription>
		  <requestID />
		</d3p1:eiResponse>
		<d3p1:eventResponses>
		  <d3p1:eventResponse>
			<d3p1:responseCode>200</d3p1:responseCode>
			<d3p1:responseDescription>OK</d3p1:responseDescription>
			<requestID>${requestID}</requestID>
			<d3p1:qualifiedEventID>
			  <d3p1:eventID>${eventID}</d3p1:eventID>
			  <d3p1:modificationNumber>${modificationNumber}</d3p1:modificationNumber>
			</d3p1:qualifiedEventID>
			<d3p1:optType>optIn</d3p1:optType>
		  </d3p1:eventResponse>
		</d3p1:eventResponses>
		<d3p1:venID>${ven_ID}</d3p1:venID>
	  </eiCreatedEvent>
	</oadrCreatedEvent>
  </oadrSignedObject>
</oadrPayload>`;
		}

		// Extract signal IDs and values from event XML
		function extractSignalValues(doc, isEvent2 = false) {
			const array_signalID = [];
			const array_value = [];
			for (let i = 0; i < 50; i++) {
				let signalID, value;
				if (isEvent2) {
					signalID = xpath.select("//*[local-name(.)='eiEvent']/*[local-name(.)='eiEventSignals']/*[local-name(.)='eiEventSignal']/*[local-name(.)='signalID']/text()", doc)[i];
					value = xpath.select("//*[local-name(.)='eiEvent']/*[local-name(.)='eiEventSignals']/*[local-name(.)='eiEventSignal']/*[local-name(.)='currentValue']/*[local-name(.)='payloadFloat']/*[local-name(.)='value']/text()", doc)[i];
				} else {
					signalID = xpath.select("//*[local-name(.)='signalID']/text()", doc)[i];
					value = xpath.select("//*[local-name(.)='currentValue']/*[local-name(.)='payloadFloat']/*[local-name(.)='value']/text()", doc)[i];
				}
				if (value === undefined) break;
				array_signalID.push(signalID ? signalID.nodeValue : "");
				array_value.push(value ? value.nodeValue : "");
			}
			return { array_signalID, array_value };
		}

		// Validate XML against XSD schema
		function validateXML(xml, xsdPath) {
			const xsdString = fs.readFileSync(xsdPath, 'utf8');
			const xmlDoc = libxmljs.parseXml(xml);
			const xsdDoc = libxmljs.parseXml(xsdString);
			const valid = xmlDoc.validate(xsdDoc);
			if (!valid) {
				console.error(xmlDoc.validationErrors);
			}
			return valid;
		}

		// Usage example:
		const isValid = validateXML(myXMLregistration2b, __dirname + '/schemas/oadr-2_0b.xsd');
		if (!isValid) {
			node.error("XML failed schema validation");
			return;
		}

		// 2.0b: Handle incoming oadrRegisterReport and send oadrRegisteredReport
		function handleRegisterReport(body, ven_ID) {
			const xsdPath = __dirname + '/schemas/oadr-2_0b.xsd';
			// Validate incoming oadrRegisterReport XML
			if (!validateXML(body, xsdPath)) {
				node.error("Incoming oadrRegisterReport XML failed schema validation");
				node.status({ fill: "red", shape: "dot", text: "Schema validation failed" });
				return;
			}
			logExchange("oadrRegisterReport", "", "oadrRegisterReport", body);

			// Send oadrRegisteredReport in response
			oadrRegisteredReport(ven_ID);

			// Optionally, start periodic reporting if requested
			startPeriodicReporting(ven_ID);
		}

		// 2.0b: Periodic and on-demand reporting
		let reportIntervalID = null;
		function startPeriodicReporting(ven_ID) {
			// Example: send a report every 60 seconds (customize as needed)
			const reportPeriod = 60 * 1000;
			if (reportIntervalID) clearInterval(reportIntervalID);
			reportIntervalID = setInterval(() => {
				sendReport(ven_ID);
			}, reportPeriod);
			node.status({ fill: "blue", shape: "dot", text: "Reporting started" });
		}

		function stopPeriodicReporting() {
			if (reportIntervalID) clearInterval(reportIntervalID);
			node.status({ fill: "grey", shape: "ring", text: "Reporting stopped" });
		}

		// Send a report (EiReport) to the VTN
		function sendReport(ven_ID, reportRequestID = null) {
			const now = new Date().toISOString();
			const reportID = "VEN_Report_001";
			const reportSpecifierID = "VEN_Specifier_001";
			const readingValue = Math.random() * 100; // Example: random value, replace with real data

			const myXMLreport = `<?xml version="1.0" encoding="utf-8"?>
<oadrPayload xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns="http://openadr.org/oadr-2.0b/2012/07">
  <oadrSignedObject>
    <oadrUpdateReport d3p1:schemaVersion="2.0b" xmlns:d3p1="http://docs.oasis-open.org/ns/energyinterop/201110">
      <d3p1:report>
        <d3p1:eiReportID>${reportID}</d3p1:eiReportID>
        <d3p1:reportSpecifierID>${reportSpecifierID}</d3p1:reportSpecifierID>
        <d3p1:reportName>METADATA_TELEMETRY_USAGE</d3p1:reportName>
        <d3p1:createdDateTime>${now}</d3p1:createdDateTime>
        <d3p1:intervals>
          <d3p1:interval>
            <d3p1:dtstart>
              <d3p1:date-time>${now}</d3p1:date-time>
            </d3p1:dtstart>
            <d3p1:duration>PT1M</d3p1:duration>
            <d3p1:reportPayload>
              <d3p1:rID>power_real</d3p1:rID>
              <d3p1:value>${readingValue.toFixed(2)}</d3p1:value>
            </d3p1:reportPayload>
          </d3p1:interval>
        </d3p1:intervals>
        <d3p1:reportRequestID>${reportRequestID || ""}</d3p1:reportRequestID>
        <d3p1:venID>${ven_ID}</d3p1:venID>
      </d3p1:report>
    </oadrUpdateReport>
  </oadrSignedObject>
</oadrPayload>`;

			const xsdPath = __dirname + '/schemas/oadr-2_0b.xsd';
			if (!validateXML(myXMLreport, xsdPath)) {
				node.error("Outgoing oadrUpdateReport XML failed schema validation");
				node.status({ fill: "red", shape: "dot", text: "Schema validation failed" });
				return;
			}
			request({
				url: node.url + '/OpenADR2/Simple/2.0b/EiReport',
				method: "POST",
				headers: { "content-type": "application/xml" },
				body: myXMLreport,
				...sslOptions
			}, function (error, response, body) {
				if (error) {
					node.error("Network error: " + error.message, { error });
					node.status({ fill: "red", shape: "ring", text: "Network error" });
					return;
				}
				if (!response || response.statusCode < 200 || response.statusCode >= 300) {
					node.error(`HTTP error: ${response ? response.statusCode : 'No response'}`, { statusCode: response && response.statusCode, body });
					node.status({ fill: "red", shape: "dot", text: `HTTP ${response ? response.statusCode : 'ERR'}` });
					return;
				}
				if (!body) {
					node.error("Empty response from VTN");
					node.status({ fill: "yellow", shape: "ring", text: "Empty response" });
					return;
				}
				if (!validateXML(body, xsdPath)) {
					node.error("Incoming report response failed schema validation");
					node.status({ fill: "red", shape: "dot", text: "Schema validation failed" });
					return;
				}
				logExchange("oadrUpdateReport", myXMLreport, "oadrResponse", body);
				node.status({ fill: "green", shape: "dot", text: "Report sent" });
			});
		}

		// --- Update oadrPoll to handle oadrRegisterReport and oadrRequestReport ---
		function oadrPoll(ven_ID, registrationID) {
			const myXMLpoll2b = `<?xml version="1.0" encoding="utf-8"?>
<oadrPayload xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns="http://openadr.org/oadr-2.0b/2012/07">
  <oadrSignedObject>
    <oadrPoll d3p1:schemaVersion="2.0b" xmlns:d3p1="http://docs.oasis-open.org/ns/energyinterop/201110">
      <d3p1:venID>${ven_ID}</d3p1:venID>
    </oadrPoll>
  </oadrSignedObject>
</oadrPayload>`;
			const xsdPath = __dirname + '/schemas/oadr-2_0b.xsd';
			// Validate outgoing poll XML
			if (!validateXML(myXMLpoll2b, xsdPath)) {
				node.error("Outgoing poll XML failed schema validation");
				node.status({ fill: "red", shape: "dot", text: "Schema validation failed" });
				return;
			}
			request({
				url: node.url + '/OpenADR2/Simple/2.0b/OadrPoll',
				method: "POST",
				headers: { "content-type": "application/xml" },
				body: myXMLpoll2b,
				...sslOptions
			}, function (error, response, body) {
				if (error) {
					node.error("Network error: " + error.message, { error });
					node.status({ fill: "red", shape: "ring", text: "Network error" });
					return;
				}
				if (!response || response.statusCode < 200 || response.statusCode >= 300) {
					node.error(`HTTP error: ${response ? response.statusCode : 'No response'}`, { statusCode: response && response.statusCode, body });
					node.status({ fill: "red", shape: "dot", text: `HTTP ${response ? response.statusCode : 'ERR'}` });
					return;
				}
				if (!body) {
					node.error("Empty response from VTN");
					node.status({ fill: "yellow", shape: "ring", text: "Empty response" });
					return;
				}
				if (!validateXML(body, xsdPath)) {
					node.error("Incoming poll response failed schema validation");
					node.status({ fill: "red", shape: "dot", text: "Schema validation failed" });
					return;
				}

				const doc = new dom().parseFromString(body);

				if (body.includes("oadrRegisterReport")) {
					handleRegisterReport(body, ven_ID);
				} else if (body.includes("oadrRequestReport")) {
					const reportRequestID = getText(doc, 'reportRequestID');
					sendReport(ven_ID, reportRequestID);
					node.status({ fill: "blue", shape: "dot", text: "On-demand report sent" });
				} else if (body.includes("oadrDistributeEvent")) {
					handleEiEvent(body, ven_ID);
				} else if (body.includes("oadrCreatedOpt") || body.includes("oadrCanceledOpt")) {
					handleEiOptResponse(body);
				} else if (body.includes("oadrResponse")) {
					node.status({ fill: "green", shape: "dot", text: "oadrResponse received" });
				}
				// ...other handlers as needed...
			});
		}

	}

	// Register the OpenADR node with Node-RED
	RED.nodes.registerType("OpenADR", OpenADR);
};
