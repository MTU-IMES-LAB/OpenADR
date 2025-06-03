const assert = require('assert');
const fs = require('fs');
const libxmljs = require('libxmljs2');
const path = require('path');

describe('OpenADR Node', function() {
    const schemaPath = path.join(__dirname, '../schemas/oadr-2_0b.xsd');
    const registrationXmlPath = path.join(__dirname, '../sample-registration.xml');
    const reportXmlPath = path.join(__dirname, '../sample-report.xml');

    it('should validate registration XML against schema', function() {
        const xml = fs.readFileSync(registrationXmlPath, 'utf8');
        const xsdString = fs.readFileSync(schemaPath, 'utf8');
        const xmlDoc = libxmljs.parseXml(xml);
        const xsdDoc = libxmljs.parseXml(xsdString);
        assert(xmlDoc.validate(xsdDoc), 'Registration XML does not validate against schema');
    });

    it('should validate report XML against schema', function() {
        const xml = fs.readFileSync(reportXmlPath, 'utf8');
        const xsdString = fs.readFileSync(schemaPath, 'utf8');
        const xmlDoc = libxmljs.parseXml(xml);
        const xsdDoc = libxmljs.parseXml(xsdString);
        assert(xmlDoc.validate(xsdDoc), 'Report XML does not validate against schema');
    });

    it('should generate a valid random report XML', function() {
        // Simulate the sendReport function's output
        const now = new Date().toISOString();
        const reportID = "VEN_Report_001";
        const reportSpecifierID = "VEN_Specifier_001";
        const readingValue = Math.random() * 100;
        const ven_ID = "testVEN";
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
        <d3p1:reportRequestID></d3p1:reportRequestID>
        <d3p1:venID>${ven_ID}</d3p1:venID>
      </d3p1:report>
    </oadrUpdateReport>
  </oadrSignedObject>
</oadrPayload>`;
        const xsdString = fs.readFileSync(schemaPath, 'utf8');
        const xmlDoc = libxmljs.parseXml(myXMLreport);
        const xsdDoc = libxmljs.parseXml(xsdString);
        assert(xmlDoc.validate(xsdDoc), 'Generated report XML does not validate against schema');
    });
});