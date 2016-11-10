module.exports = function(RED) {
	
	var xpath = require('xpath')  
	var dom = require('xmldom').DOMParser

	var request = require('request');    // To import the library named 'request', it is used to send HTTP post Requests
	
function OpenADR(config) {
        RED.nodes.createNode(this,config);
		this.name = config.name;
        this.url = config.url;
        this.rate = config.rate;
		this.ven_id = config.ven_id;
		this.profile = config.ven_profile;		
		
			// Below is the code to take input of optin optout message
			this.on('input', function(msg) {
				//console.log(msg.payload);
				var optmsg = msg.payload;
					
					function oadrOpt() {
						request({
						url: node.url+'/OpenADR2/Simple/2.0b/EiOpt',
						method: "POST",
						headers: {
									"content-type": "application/xml",  // <--Very important!!!
								},
								body: optmsg
							}, function (error, response, body){
								
							if(optmsg.indexOf("oadrCreateOpt") > -1) {
							console.log("\n VEN ------------oadrCreateOpt--------------> VTN \n")
							console.log(new Date().toISOString())
							console.log(optmsg)
							console.log("\n VTN ------------oadrCreatedOpt--------------> VEN \n")
							console.log(new Date().toISOString())
							console.log(body)	
						}
							else if (optmsg.indexOf("oadrCancelOpt") > -1) {
							console.log("\n VEN ------------oadrCancelOpt--------------> VTN \n")
							console.log(new Date().toISOString())
							console.log(optmsg)
							console.log("\n VTN ------------oadrCanceledOpt--------------> VEN \n")
							console.log(new Date().toISOString())
							console.log(body)	
						}
							
							});
					}
					
				oadrOpt();
			});		
        		
		var node = this;
		var timerID;
		

		// Below is the main code for OpenADR message Requests
		
		if (node.profile=='A'){
		
			timerID = setInterval(function(){                 
			  node.status({fill:"green",shape:"dot",text:"Requesting"});
								
				requestevent();
								
			}, (node.rate*1000 + Math.random()));  
				
		}
		
		else {
			oadrQueryRegistration();
			oadrCreatePartyRegistration();
			
		}
		
// Below are the HTTP post Requests for various functions specified in OpenADR specification
//---------------------------------------------------------------------------------------------------------------------------------------//
				// Function for EiRequestEvent 2.0a
            	function requestevent() {
					
					// HTTP Post Request XML for oadr 2a Request Event
					var myXMLrequesteventa = '<oadr:oadrRequestEvent xmlns:ei="http://docs.oasis-open.org/ns/energyinterop/201110" xmlns:emix="http://docs.oasis-open.org/ns/emix/2011/06" xmlns:oadr="http://openadr.org/oadr-2.0a/2012/07" xmlns:pyld="http://docs.oasis-open.org/ns/energyinterop/201110/payloads" xmlns:strm="urn:ietf:params:xml:ns:icalendar-2.0:stream" xmlns:xcal="urn:ietf:params:xml:ns:icalendar-2.0">   <pyld:eiRequestEvent>     <ei:requestID/>     <ei:venID>'+node.ven_id+'</ei:venID>     <pyld:replyLimit>99</pyld:replyLimit>   </pyld:eiRequestEvent> </oadr:oadrRequestEvent>'
					
					
					request({
					url: node.url+'/OpenADR2/Simple/EiEvent',
					method: "POST",
					headers: {
								"content-type": "application/xml",  // <--Very important!!!
							},
							body: myXMLrequesteventa
						}, function (error, response, body){
						// Error Handling
						if (body==undefined){
							//console.log(response);
						}
						else if (response.statusCode==503){
							requestevent();
						}
						else if (response.statusCode==500){
							requestevent();
						}						
					
					
					var msg = { payload:body }
									
					node.send(msg);
						});
				}
				

//----------------------------------------------------------------------------------------------------------------------------------//
				
				// Function for EiRegistration
				function oadrCreatePartyRegistration() {
					
					// HTTP Post Request XML for oadr 2b request registration	
					var myXMLregistration2b = '<?xml version="1.0" encoding="utf-8"?> <oadrPayload xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns="http://openadr.org/oadr-2.0b/2012/07">   <oadrSignedObject>     <oadrCreatePartyRegistration d3p1:schemaVersion="2.0b" xmlns:d3p1="http://docs.oasis-open.org/ns/energyinterop/201110">       <requestID xmlns="http://docs.oasis-open.org/ns/energyinterop/201110/payloads">50004</requestID>       <d3p1:venID>'+node.ven_id+'</d3p1:venID> <oadrVenName>'+node.name+'</oadrVenName>       <oadrProfileName>2.0b</oadrProfileName>       <oadrTransportName>simpleHttp</oadrTransportName>       <oadrTransportAddress />       <oadrReportOnly>false</oadrReportOnly>       <oadrXmlSignature>false</oadrXmlSignature>       <oadrHttpPullModel>true</oadrHttpPullModel>     </oadrCreatePartyRegistration>   </oadrSignedObject> </oadrPayload>'
					
					
					request({
					url: node.url+'/OpenADR2/Simple/2.0b/EiRegisterParty',
					method: "POST",
					
					
					headers: {
								"content-type": "application/xml",  // <--Very important!!!
							},
							body: myXMLregistration2b
						}, function (error, response, body){
							
					console.log("\n VEN ----------oadrCreatePartyRegistration-------------> VTN \n")
					console.log(new Date().toISOString())
					console.log(myXMLregistration2b)
					console.log("\n VTN ----------oadrCreatedPartyRegistration------------> VEN \n")
					console.log(new Date().toISOString())
					console.log(body)
					//return body;
					// Grab data from response xml
						var doc = new dom().parseFromString(body)
						var registrationID = xpath.select("//*[local-name(.)='registrationID']/text()", doc)[0]
						var ven_ID = xpath.select("//*[local-name(.)='venID']/text()", doc)[0]
						console.log("Registration ID is "+registrationID)
						console.log("VEN ID is "+ven_ID)
						
						// Error Handling
						if (body==undefined){
							console.log(response);
						}
						else if (response.statusCode==500){
							oadrCreatePartyRegistration();
						}						
						else if (response.statusCode==503){
							oadrCreatePartyRegistration();
						}
						
						oadrPoll(ven_ID);

						setTimeout(function (){

						// Something you want delayed.
						requestevent2(ven_ID);
						}, 500);

						timerID = setInterval(function(){                 
						  node.status({fill:"green",shape:"dot",text:"Requesting"});
						  
							//requestevent2();
							oadrPoll(ven_ID);
							
						}, (node.rate*1000 + Math.random()));  

					});
				}
				
//------------------------------------------------------------------------------------------------------------------------------//
				// Function for QueryRegistration
				function oadrQueryRegistration() {
					
					// HTTP Post Request XML for oadr 2b request registration	
					var myXMLQueryRegistration = '<?xml version="1.0" encoding="utf-8"?> <oadrPayload xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns="http://openadr.org/oadr-2.0b/2012/07">   <oadrSignedObject>     <oadrQueryRegistration d3p1:schemaVersion="2.0b" xmlns:d3p1="http://docs.oasis-open.org/ns/energyinterop/201110">       <requestID xmlns="http://docs.oasis-open.org/ns/energyinterop/201110/payloads">f6fe9f8aa5</requestID>     </oadrQueryRegistration>   </oadrSignedObject> </oadrPayload>'
					
					request({
					url: node.url+'/OpenADR2/Simple/2.0b/EiRegisterParty',
					method: "POST",
					
					
					headers: {
								"content-type": "application/xml",  // <--Very important!!!
							},
							body: myXMLQueryRegistration
						}, function (error, response, body){
							
					console.log("\n VEN ----------oadrQueryRegistration-------------> VTN \n")
					console.log(new Date().toISOString())
					console.log(myXMLQueryRegistration)
					console.log("\n VTN ----------oadrCreatedPartyRegistration------------> VEN \n")
					console.log(new Date().toISOString())
					console.log(body)
						// Error Handling
						if (body==undefined){
							console.log(response);
						}
						else if (response.statusCode==500){
							oadrCreatePartyRegistration();
						}						
						else if (response.statusCode==503){
							oadrCreatePartyRegistration();
						}
						
						});
				}
				
				
				
//--------------------------------------------------------------------------------------------------------------------------//
				// Functions for EiReport
				
				function oadrRegisterReport() {
					
					// Post Request XML for oadr 2b Register Report
					var myXMLregisterreport = '<?xml version="1.0" encoding="utf-8"?> <oadrPayload xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns="http://openadr.org/oadr-2.0b/2012/07">   <oadrSignedObject>     <oadrRegisterReport d3p1:schemaVersion="2.0b" xmlns:d3p1="http://docs.oasis-open.org/ns/energyinterop/201110">       <requestID xmlns="http://docs.oasis-open.org/ns/energyinterop/201110/payloads">6a31809173</requestID>       <oadrReport>         <duration xmlns="urn:ietf:params:xml:ns:icalendar-2.0">           <duration>PT2H</duration>         </duration>         <oadrReportDescription>           <d3p1:rID>resource1_status</d3p1:rID>           <d3p1:reportDataSource>             <d3p1:resourceID>resource1</d3p1:resourceID>           </d3p1:reportDataSource>           <d3p1:reportType>x-resourceStatus</d3p1:reportType>           <d3p1:readingType>x-notApplicable</d3p1:readingType>           <marketContext xmlns="http://docs.oasis-open.org/ns/emix/2011/06">http://MarketContext1</marketContext>           <oadrSamplingRate>             <oadrMinPeriod>PT1M</oadrMinPeriod>             <oadrMaxPeriod>PT1M</oadrMaxPeriod>             <oadrOnChange>false</oadrOnChange>           </oadrSamplingRate>         </oadrReportDescription>         <d3p1:reportRequestID>0</d3p1:reportRequestID>         <d3p1:reportSpecifierID>789ed6cd4e_telemetry_status</d3p1:reportSpecifierID>         <d3p1:reportName>METADATA_TELEMETRY_STATUS</d3p1:reportName>         <d3p1:createdDateTime>'+new Date().toISOString()+'</d3p1:createdDateTime>       </oadrReport>       <oadrReport>         <duration xmlns="urn:ietf:params:xml:ns:icalendar-2.0">           <duration>PT2H</duration>         </duration>         <oadrReportDescription>           <d3p1:rID>resource1_energy</d3p1:rID>           <d3p1:reportDataSource>             <d3p1:resourceID>resource1</d3p1:resourceID>           </d3p1:reportDataSource>           <d3p1:reportType>usage</d3p1:reportType>           <energyReal xmlns="http://docs.oasis-open.org/ns/emix/2011/06/power">             <itemDescription>RealEnergy</itemDescription>             <itemUnits>Wh</itemUnits>             <siScaleCode xmlns="http://docs.oasis-open.org/ns/emix/2011/06/siscale">n</siScaleCode>           </energyReal>           <d3p1:readingType>Direct Read</d3p1:readingType>           <marketContext xmlns="http://docs.oasis-open.org/ns/emix/2011/06">http://MarketContext1</marketContext>           <oadrSamplingRate>             <oadrMinPeriod>PT1M</oadrMinPeriod>             <oadrMaxPeriod>PT1M</oadrMaxPeriod>             <oadrOnChange>false</oadrOnChange>           </oadrSamplingRate>         </oadrReportDescription>         <oadrReportDescription>           <d3p1:rID>resource1_power</d3p1:rID>           <d3p1:reportDataSource>             <d3p1:resourceID>resource1</d3p1:resourceID>           </d3p1:reportDataSource>           <d3p1:reportType>usage</d3p1:reportType>           <powerReal xmlns="http://docs.oasis-open.org/ns/emix/2011/06/power">             <itemDescription>RealPower</itemDescription>             <itemUnits>W</itemUnits>             <siScaleCode xmlns="http://docs.oasis-open.org/ns/emix/2011/06/siscale">n</siScaleCode>             <powerAttributes>               <hertz>60</hertz>               <voltage>110</voltage>               <ac>false</ac>             </powerAttributes>           </powerReal>           <d3p1:readingType>Direct Read</d3p1:readingType>           <marketContext xmlns="http://docs.oasis-open.org/ns/emix/2011/06">http://MarketContext1</marketContext>           <oadrSamplingRate>             <oadrMinPeriod>PT1M</oadrMinPeriod>             <oadrMaxPeriod>PT1M</oadrMaxPeriod>             <oadrOnChange>false</oadrOnChange>           </oadrSamplingRate>         </oadrReportDescription>         <d3p1:reportRequestID>0</d3p1:reportRequestID>         <d3p1:reportSpecifierID>789ed6cd4e_telemetry_usage</d3p1:reportSpecifierID>         <d3p1:reportName>METADATA_TELEMETRY_USAGE</d3p1:reportName>         <d3p1:createdDateTime>'+new Date().toISOString()+'</d3p1:createdDateTime>       </oadrReport>       <oadrReport>         <duration xmlns="urn:ietf:params:xml:ns:icalendar-2.0">           <duration>PT2H</duration>         </duration>         <oadrReportDescription>           <d3p1:rID>resource1_energy</d3p1:rID>           <d3p1:reportDataSource>             <d3p1:resourceID>resource1</d3p1:resourceID>           </d3p1:reportDataSource>           <d3p1:reportType>usage</d3p1:reportType>           <energyReal xmlns="http://docs.oasis-open.org/ns/emix/2011/06/power">             <itemDescription>RealEnergy</itemDescription>             <itemUnits>Wh</itemUnits>             <siScaleCode xmlns="http://docs.oasis-open.org/ns/emix/2011/06/siscale">n</siScaleCode>           </energyReal>           <d3p1:readingType>Direct Read</d3p1:readingType>           <marketContext xmlns="http://docs.oasis-open.org/ns/emix/2011/06">http://MarketContext1</marketContext>           <oadrSamplingRate>             <oadrMinPeriod>PT1M</oadrMinPeriod>             <oadrMaxPeriod>PT1M</oadrMaxPeriod>             <oadrOnChange>false</oadrOnChange>           </oadrSamplingRate>         </oadrReportDescription>         <oadrReportDescription>           <d3p1:rID>resource1_power</d3p1:rID>           <d3p1:reportDataSource>             <d3p1:resourceID>resource1</d3p1:resourceID>           </d3p1:reportDataSource>           <d3p1:reportType>usage</d3p1:reportType>           <powerReal xmlns="http://docs.oasis-open.org/ns/emix/2011/06/power">             <itemDescription>RealPower</itemDescription>             <itemUnits>W</itemUnits>             <siScaleCode xmlns="http://docs.oasis-open.org/ns/emix/2011/06/siscale">n</siScaleCode>             <powerAttributes>               <hertz>60</hertz>               <voltage>110</voltage>               <ac>false</ac>             </powerAttributes>           </powerReal>           <d3p1:readingType>Direct Read</d3p1:readingType>           <marketContext xmlns="http://docs.oasis-open.org/ns/emix/2011/06">http://MarketContext1</marketContext>           <oadrSamplingRate>             <oadrMinPeriod>PT1M</oadrMinPeriod>             <oadrMaxPeriod>PT1M</oadrMaxPeriod>             <oadrOnChange>false</oadrOnChange>           </oadrSamplingRate>         </oadrReportDescription>         <d3p1:reportRequestID>0</d3p1:reportRequestID>         <d3p1:reportSpecifierID>789ed6cd4e_history_usage</d3p1:reportSpecifierID>         <d3p1:reportName>METADATA_HISTORY_USAGE</d3p1:reportName>         <d3p1:createdDateTime>'+new Date().toISOString()+'</d3p1:createdDateTime>       </oadrReport>       <d3p1:venID>'+node.ven_id+'</d3p1:venID>     </oadrRegisterReport>   </oadrSignedObject> </oadrPayload>'	
					
					
					request({
					url: node.url+'/OpenADR2/Simple/2.0b/EiReport',
					method: "POST",
					headers: {
								"content-type": "application/xml",  // <--Very important!!!
							},
							body: myXMLregisterreport
						}, function (error, response, body){
							

						console.log(" \n VEN --------oadrRegisterReport----------> VTN \n")
						console.log(new Date().toISOString())
						console.log(myXMLregisterreport)
						console.log(" \n VEN --------oadrRegisteredReport----------> VTN \n")
						console.log(new Date().toISOString())
						console.log(body)
						// Error Handling
						if (body==undefined){
							console.log(response);
						}
						else if (response.statusCode==500){
							oadrRegisterReport();
						}						
						else if (response.statusCode==503){
							oadrRegisterReport();
						}							
						});
				}
				

//-----------------------------------------------------------------------------------------------------------------//
				
				function oadrCreatedEvent() {
					
					// HTTP Post Request XML for createdEvent
					var myXMLcreatedevent = '<?xml version="1.0" encoding="utf-8"?> <oadrPayload xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns="http://openadr.org/oadr-2.0b/2012/07">   <oadrSignedObject>     <oadrCreatedEvent d3p1:schemaVersion="2.0b" xmlns:d3p1="http://docs.oasis-open.org/ns/energyinterop/201110">       <eiCreatedEvent xmlns="http://docs.oasis-open.org/ns/energyinterop/201110/payloads">         <d3p1:eiResponse>           <d3p1:responseCode>200</d3p1:responseCode>           <d3p1:responseDescription>OK</d3p1:responseDescription>           <requestID />         </d3p1:eiResponse>         <d3p1:eventResponses>           <d3p1:eventResponse>             <d3p1:responseCode>200</d3p1:responseCode>             <d3p1:responseDescription>OK</d3p1:responseDescription>             <requestID>dbadee7f0982a07a9d69</requestID>             <d3p1:qualifiedEventID>               <d3p1:eventID>a86cde0e40d34c0c1cb5</d3p1:eventID>               <d3p1:modificationNumber>9</d3p1:modificationNumber>             </d3p1:qualifiedEventID>             <d3p1:optType>optIn</d3p1:optType>           </d3p1:eventResponse>         </d3p1:eventResponses>         <d3p1:venID>'+node.ven_id+'</d3p1:venID>       </eiCreatedEvent>     </oadrCreatedEvent>   </oadrSignedObject> </oadrPayload>'
					
					
					request({
					url: node.url+'/OpenADR2/Simple/2.0b/EiEvent',
					method: "POST",
					headers: {
								"content-type": "application/xml",  // <--Very important!!!
							},
							body: myXMLcreatedevent
						}, function (error, response, body){
							
							console.log("\n VEN ----oadrCreatedEvent------> VTN \n")
							console.log(new Date().toISOString())
							console.log(myXMLcreatedevent)
							console.log("\n VTN ----oadrResponse------> VEN \n")
							console.log(new Date().toISOString())
							console.log(body)
						// Error Handling
						if (body==undefined){
							console.log(response);
						}
						else if (response.statusCode==500){
							oadrCreatedEvent();
						}						
						else if (response.statusCode==503){
							oadrCreatedEvent();
						}							
						});
				}
				
//-------------------------------------------------------------------------------------------------------------------//
				
				function oadrRegisteredReport(ven_ID) {
					
					// Post Request XML for oadr 2b Registered Report
					var myXMLregisteredreport = '<?xml version="1.0" encoding="utf-8"?> <oadrPayload xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns="http://openadr.org/oadr-2.0b/2012/07">   <oadrSignedObject>     <oadrRegisteredReport d3p1:schemaVersion="2.0b" xmlns:d3p1="http://docs.oasis-open.org/ns/energyinterop/201110">       <d3p1:eiResponse>         <d3p1:responseCode>200</d3p1:responseCode>         <d3p1:responseDescription>OK</d3p1:responseDescription>         <requestID xmlns="http://docs.oasis-open.org/ns/energyinterop/201110/payloads">1e7f5f377168380276ab</requestID>       </d3p1:eiResponse>       <d3p1:venID>'+ven_ID+'</d3p1:venID>     </oadrRegisteredReport>   </oadrSignedObject> </oadrPayload>'
					
					request({
					url: node.url+'/OpenADR2/Simple/2.0b/EiReport',
					method: "POST",
					headers: {
								"content-type": "application/xml",  // <--Very important!!!
							},
							body: myXMLregisteredreport
						}, function (error, response, body){
							console.log("\n VEN ----oadrRegisteredReport-----> VTN \n")
							console.log(new Date().toISOString())
							console.log(myXMLregisteredreport)
							console.log("\n VTN ----oadrResponse-----> VEN \n")
							console.log(new Date().toISOString())
							console.log(body)
						// Error Handling
						if (body==undefined){
							console.log(response);
						}
						else if (response.statusCode==500){
							oadrRegisteredReport();
						}						
						else if (response.statusCode==503){
							oadrRegisteredReport();
						}							
							
						});
				}
				
				
//----------------------------------------------------------------------------------------------------------------//
				
				function oadrResponse(ven_ID) {
					
					var myXMLresponse='<?xml version="1.0" encoding="UTF-8" standalone="yes"?> <ns2:oadrPayload xmlns:ns1="http://docs.oasis-open.org/ns/energyinterop/201110" xmlns:ns2="http://openadr.org/oadr-2.0b/2012/07" xmlns:ns3="http://www.w3.org/2005/Atom" xmlns:ns4="http://docs.oasis-open.org/ns/emix/2011/06/power" xmlns:ns5="http://docs.oasis-open.org/ns/emix/2011/06/siscale" xmlns:ns6="http://www.opengis.net/gml/3.2" xmlns:ns7="http://www.w3.org/2009/xmldsig11#" xmlns:ns8="http://www.w3.org/2000/09/xmldsig#" xmlns:ns9="http://openadr.org/oadr-2.0b/2012/07/xmldsig-properties" xmlns:ns10="urn:ietf:params:xml:ns:icalendar-2.0" xmlns:ns11="http://docs.oasis-open.org/ns/emix/2011/06" xmlns:ns12="http://docs.oasis-open.org/ns/energyinterop/201110/payloads" xmlns:ns13="urn:ietf:params:xml:ns:icalendar-2.0:stream" xmlns:ns14="urn:un:unece:uncefact:codelist:standard:5:ISO42173A:2010-04-07">     <ns2:oadrSignedObject>         <ns2:oadrResponse ns1:schemaVersion="2.0b">             <ns1:eiResponse>                 <ns1:responseCode>200</ns1:responseCode>                 <ns1:responseDescription>OK</ns1:responseDescription>                 <ns12:requestID></ns12:requestID>             </ns1:eiResponse>             <ns1:venID>'+ven_ID+'</ns1:venID>         </ns2:oadrResponse>     </ns2:oadrSignedObject> </ns2:oadrPayload>'
					
					
					request({
					url: node.url+'/OpenADR2/Simple/2.0b/EiReport',
					method: "POST",
					headers: {
								"content-type": "application/xml",  // <--Very important!!!
							},
							body: myXMLresponse
						}, function (error, response, body){
							console.log("\n VEN ----oadrResponse-----> VTN \n")
							console.log(new Date().toISOString())
							console.log(myXMLresponse)
							console.log("\n VTN ----http(200)-----> VEN \n")
							console.log(new Date().toISOString())
							console.log(body)
						// Error Handling
						if (body==undefined){
							console.log(response);
						}
						else if (response.statusCode==500){
							oadrResponse();
						}						
						else if (response.statusCode==503){
							oadrResponse();
						}							
							
						});
				}
				
				
//-------------------------------------------------------------------------------------------------------------//
				
				
				// Function for EiPoll
				
				function oadrPoll(ven_ID) {
					
					// HTTP Post Request XML for oadr 2b Poll
					var myXMLpoll2b = '<?xml version="1.0" encoding="utf-8"?> <oadrPayload xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns="http://openadr.org/oadr-2.0b/2012/07">   <oadrSignedObject>     <oadrPoll d3p1:schemaVersion="2.0b" xmlns:d3p1="http://docs.oasis-open.org/ns/energyinterop/201110">       <d3p1:venID>'+ven_ID+'</d3p1:venID>     </oadrPoll>   </oadrSignedObject> </oadrPayload>'
					
					
					request({
					url: node.url+'/OpenADR2/Simple/2.0b/OadrPoll',
					method: "POST",
					headers: {
								"content-type": "application/xml",  // <--Very important!!!
							},
							body: myXMLpoll2b
						}, function (error, response, body){ 
						
						console.log("\n VEN ----oadrPoll-----> VTN \n")
						console.log(new Date().toISOString())
						console.log(myXMLpoll2b)
						
						
						if (body==undefined){
							//console.log(response);
						}
						else if(body.indexOf("oadrDistributeEvent") > -1) {
						//var msg = { payload:body }
						//node.send(msg);
						if(body.indexOf("oadrResponseRequired>always<") > -1){
						oadrCreatedEvent();	
						} 
						// Grab data from response xml
						var doc = new dom().parseFromString(body)
						var requestID = xpath.select("//*[local-name(.)='requestID']/text()", doc)[0]
						var eventID = xpath.select("//*[local-name(.)='eventID']/text()", doc)[0]
						var modificationNumber = xpath.select("//*[local-name(.)='modificationNumber']/text()", doc)[0]
						
						//HTTP Post Request XML for createdEvent
						var myXMLcreatedevent = '<?xml version="1.0" encoding="utf-8"?> <oadrPayload xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns="http://openadr.org/oadr-2.0b/2012/07">   <oadrSignedObject>     <oadrCreatedEvent d3p1:schemaVersion="2.0b" xmlns:d3p1="http://docs.oasis-open.org/ns/energyinterop/201110">       <eiCreatedEvent xmlns="http://docs.oasis-open.org/ns/energyinterop/201110/payloads">         <d3p1:eiResponse>           <d3p1:responseCode>200</d3p1:responseCode>           <d3p1:responseDescription>OK</d3p1:responseDescription>           <requestID />         </d3p1:eiResponse>         <d3p1:eventResponses>           <d3p1:eventResponse>             <d3p1:responseCode>200</d3p1:responseCode>             <d3p1:responseDescription>OK</d3p1:responseDescription>             <requestID>'+requestID+'</requestID>             <d3p1:qualifiedEventID>               <d3p1:eventID>'+eventID+'</d3p1:eventID>               <d3p1:modificationNumber>'+modificationNumber+'</d3p1:modificationNumber>             </d3p1:qualifiedEventID>             <d3p1:optType>optIn</d3p1:optType>           </d3p1:eventResponse>         </d3p1:eventResponses>         <d3p1:venID>'+ven_ID+'</d3p1:venID>       </eiCreatedEvent>     </oadrCreatedEvent>   </oadrSignedObject> </oadrPayload>'
						var array_value=[];
						var array_signalID=[];
						for(var i=0;i<50;i++){
						var signalID = xpath.select("//*[local-name(.)='signalID']/text()", doc)[i]
						var value = xpath.select("//*[local-name(.)='currentValue']/*[local-name(.)='payloadFloat']/*[local-name(.)='value']/text()", doc)[i]
						array_value.push('"'+ value +'"' )
						array_signalID.push('"'+ signalID+ '"')
						if (value===undefined){ break;}
						
						else if(value!==undefined){
						
						
						}
						
						
						
						//console.log(value.nodeValue)
						}
						
						var msg = { payload:body, all_data: '{"signalID":['+array_signalID +'], "CurrentValue":['+array_value +']}', value:array_value}
						node.send(msg);
						console.log("\n VTN ----oadrDistributeEvent-----> VEN \n")
						console.log(new Date().toISOString())
						console.log(body)
						
						}
						
						else if(body.indexOf("oadrResponse") > -1) {
						console.log("\n VTN ----oadrResponse-----> VEN \n")
						console.log(new Date().toISOString())
						console.log(body)
						//console.log(body)
						}
						
						else if(body.indexOf("oadrRequestRegistration") > -1) {
						console.log("\n VTN-------oadrRequestRegistration---------->  VEN \n")
						console.log(new Date().toISOString())
						console.log(body)
						oadrCreatePartyRegistration();
						}
						
						else if(body.indexOf("oadrCreateReport") > -1) {
						
						console.log(body)
						}
						
						else if(body.indexOf("oadrRegisterReport") > -1) {
						console.log("\n VTN ----oadrRegisterReport-----> VEN \n")
						console.log(body)
						
						oadrRegisteredReport(ven_ID);
						}
						
						else if(body.indexOf("oadrCancelReport") > -1) {
						
						console.log(body)
						}
						
						else if(body.indexOf("oadrUpdateReport") > -1) {
						
						console.log(body)
						}
						
						else if(body.indexOf("oadrCancelPartyRegistration") > -1) {
						
						console.log("\n VTN ------------oadrCancelPartyRegistration--------------> VEN \n")
						console.log(new Date().toISOString())
						console.log(body)
						console.log("\n VEN ------------oadrCanceledPartyRegistration--------------> VTN \n")
						console.log(new Date().toISOString())
						var myXMLCanceledRegistration = '<?xml version="1.0" encoding="utf-8"?> <oadrPayload xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns="http://openadr.org/oadr-2.0b/2012/07">   <oadrSignedObject>     <oadrCanceledPartyRegistration d3p1:schemaVersion="2.0b" xmlns:d3p1="http://docs.oasis-open.org/ns/energyinterop/201110">       <d3p1:eiResponse>         <d3p1:responseCode>200</d3p1:responseCode>         <requestID xmlns="http://docs.oasis-open.org/ns/energyinterop/201110/payloads">9b9752581e7c18fe5268</requestID>       </d3p1:eiResponse>       <d3p1:registrationID>4dfdffb24e3ec3541cab</d3p1:registrationID>       <d3p1:venID>'+node.ven_id+'</d3p1:venID>     </oadrCanceledPartyRegistration>   </oadrSignedObject> </oadrPayload>'
						console.log(myXMLCanceledRegistration)
						
						}
						
						else if(body.indexOf("oadrRequestReregistration") > -1) {
							
						console.log("\n VTN ------------oadrRequestReregistration--------------> VEN \n")
						console.log(new Date().toISOString())
						console.log(body)
						oadrResponse(ven_ID);
						oadrCreatePartyRegistration();

						
						}
						
						//console.log(body)
						// Error Handling
						
						else if (response.statusCode==500){
							oadrPoll();
						}
						
						});
						
				}
				
//-------------------------------------------------------------------------------------------------------------------------//
				
				// Function for EiRequestEvent 2.0b
				function requestevent2(ven_ID) {
					
					// HTTP Post Request XML for oadr 2b Request Event
					var myXMLrequesteventb = '<?xml version="1.0" encoding="utf-8"?> <oadrPayload xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns="http://openadr.org/oadr-2.0b/2012/07"> <oadrSignedObject> <oadrRequestEvent d3p1:schemaVersion="2.0b" xmlns:d3p1="http://docs.oasis-open.org/ns/energyinterop/201110"> <eiRequestEvent xmlns="http://docs.oasis-open.org/ns/energyinterop/201110/payloads"> <requestID></requestID> <d3p1:venID>'+ven_ID+'</d3p1:venID> </eiRequestEvent> </oadrRequestEvent> </oadrSignedObject> </oadrPayload>'
					
					request({
					url: node.url+'/OpenADR2/Simple/2.0b/EiEvent',
					method: "POST",
					headers: {
								"content-type": "application/xml",  // <--Very important!!!
							},
							body: myXMLrequesteventb
						}, function (error, response, body){
						console.log("\n VEN ----oadrRequestEvent-----> VTN \n")
						console.log(new Date().toISOString())
						console.log(myXMLrequesteventb)

						// Error Handling
						if (body==undefined){
							console.log(response);
						}
						
						else if(body.indexOf("oadrDistributeEvent") > -1) {
						
						if(body.indexOf("oadrResponseRequired>always<") > -1){
						oadrCreatedEvent();	
						} 
						
						// Grab data from response xml
						
						var doc = new dom().parseFromString(body)
						var requestID = xpath.select("//*[local-name(.)='requestID']/text()", doc)[0]
						var eventID = xpath.select("//*[local-name(.)='eventID']/text()", doc)[0]
						var modificationNumber = xpath.select("//*[local-name(.)='modificationNumber']/text()", doc)[0]
						
						
						
						
						// HTTP Post Request XML for createdEvent
						var myXMLcreatedevent = '<?xml version="1.0" encoding="utf-8"?> <oadrPayload xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns="http://openadr.org/oadr-2.0b/2012/07">   <oadrSignedObject>     <oadrCreatedEvent d3p1:schemaVersion="2.0b" xmlns:d3p1="http://docs.oasis-open.org/ns/energyinterop/201110">       <eiCreatedEvent xmlns="http://docs.oasis-open.org/ns/energyinterop/201110/payloads">         <d3p1:eiResponse>           <d3p1:responseCode>200</d3p1:responseCode>           <d3p1:responseDescription>OK</d3p1:responseDescription>           <requestID />         </d3p1:eiResponse>         <d3p1:eventResponses>           <d3p1:eventResponse>             <d3p1:responseCode>200</d3p1:responseCode>             <d3p1:responseDescription>OK</d3p1:responseDescription>             <requestID>'+requestID+'</requestID>             <d3p1:qualifiedEventID>               <d3p1:eventID>'+eventID+'</d3p1:eventID>               <d3p1:modificationNumber>'+modificationNumber+'</d3p1:modificationNumber>             </d3p1:qualifiedEventID>             <d3p1:optType>optIn</d3p1:optType>           </d3p1:eventResponse>         </d3p1:eventResponses>         <d3p1:venID>'+ven_ID+'</d3p1:venID>       </eiCreatedEvent>     </oadrCreatedEvent>   </oadrSignedObject> </oadrPayload>'
						
						
						var array_signalID = [];
						var array_value=[];
						for(var i=0;i<50;i++){
						
						var signalID = xpath.select("//*[local-name(.)='eiEvent']/*[local-name(.)='eiEventSignals']/*[local-name(.)='eiEventSignal']/*[local-name(.)='signalID']/text()", doc)[i]
						var value = xpath.select("//*[local-name(.)='eiEvent']/*[local-name(.)='eiEventSignals']/*[local-name(.)='eiEventSignal']/*[local-name(.)='currentValue']/*[local-name(.)='payloadFloat']/*[local-name(.)='value']/text()", doc)[i]
						array_signalID.push('"'+ signalID +'"');
						array_value.push('"' + value + '"');
						
						if(value!==undefined){
						

						}
						if (value===undefined){ break;}
						//console.log(value.nodeValue)
						}
						var msg = { payload:body, all_data: '{"signalID":['+array_signalID +'], "CurrentValue":['+array_value +']}', value:array_value}
						node.send(msg);
												
						console.log("\n VTN ----oadrDistributeEvent-----> VEN \n")
						console.log(new Date().toISOString())
						console.log(body)
						
						
						
						//console.log(body)
						
						
						}

						
							
							
							
						
						else if(body.indexOf("oadrResponse") > -1) {
						console.log("\n VTN ----oadrResponse-----> VEN \n")
						console.log(new Date().toISOString())
						console.log(body)
						}
						else if (response.statusCode==500){
							requestevent2();
						}						
						else if (response.statusCode==503){
							requestevent2();
						}
						
						});
				}
    }
    RED.nodes.registerType("OpenADR",OpenADR);
}
