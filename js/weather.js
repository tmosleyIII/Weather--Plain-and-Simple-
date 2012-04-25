var xmlToJson = function (doc, keys) {
	/** Transforms an XML document into JSON
	
	doc is a document
	keys is an array of strings, specifying the names of XML nodes to pull from the document
	*/
	"use strict";
	var result = {}, counter = 0;
	for (counter; counter < keys.length; counter += 1) {
		result[keys[counter]] = $(keys[counter], doc).attr('data');
	}
	return result;
};

function buildForecastInformation(forecastInformation) {
	"use strict";
	forge.logging.log('[buildForecastInformation] building internal forecast information object');
	return xmlToJson(forecastInformation, ['city', 'forecast_date']);
}

function formatImgSrc(imgURL) {
	"use strict";
	var pattern = new RegExp("[a-z_]*.gif");
	return 'img/' + pattern.exec(imgURL)[0];
}

function buildCurrentCondition(currentCondition) {
	"use strict";
	forge.logging.log('building current conditions object');
	var newCondition = xmlToJson(currentCondition, ['condition', 'temp_f', 'humidity', 'icon', 'wind_condition']);
	var validCondition = checkValidWeatherData(newCondition);
	if (validCondition === false) {
		getWeatherInfo('Dayton', populateWeatherConditions);
	} else {
		newCondition.icon = formatImgSrc(newCondition.icon);
		return newCondition;
	}

}

function checkValidWeatherData(weatherData) {
	if (typeof weatherData.condition === "undefined") {
		forge.logging.log('[buildCurrentConditions] Invalid data found under city name');
		return false;
	} else {
		return true;
	}
}
function buildForecastCondition(oldCondition) {
	"use strict";
	forge.logging.log('[buildForecastCondition] building forecast condition');
	var forecastCondition = xmlToJson(oldCondition, ['day_of_week', 'low', 'high', 'icon', 'condition']);
	forecastCondition.icon = formatImgSrc(forecastCondition.icon);
	return forecastCondition;
}

function buildForecastConditions(forecastConditions) {
	"use strict";
	var convertedForecastConditions = [];
	$(forecastConditions).each(function (index, element) {
		convertedForecastConditions.push(buildForecastCondition(element));
	});
	return convertedForecastConditions;
}

function buildWeather(parsedData) {
	"use strict";
	forge.logging.log('[buildWeather] converting data to internal representation');
	var forecastInformation = buildForecastInformation($('forecast_information', parsedData));
	var currentConditions = buildCurrentCondition($('current_conditions', parsedData));
	var forecastConditions = buildForecastConditions($('forecast_conditions', parsedData));
	return {
		forecast: forecastInformation,
		currentConditions: currentConditions,
		forecastConditions: forecastConditions
	};
}

function getWeatherInfo(location, callback) {
	'use strict';
	forge.logging.log('[getWeatherInfo] getting weather for ' + location);
	forge.request.ajax({
		url: "http://www.google.com/ig/api?weather=" + encodeURIComponent(location),
		dataType: 'xml',
		success: function (data, textStatus, jqXHR) {
			forge.logging.log('[getWeatherInfo] success');
			var weatherObj = buildWeather(data);
			callback(weatherObj);
		},
		error: function (jqXHR, textStatus, errorThrown) {
			forge.logging.log('ERROR! [getWeatherInfo] ' + textStatus);
		}
	});
}

function buildLocation(parsedData) {
	"use strict";
	forge.logging.log('[buildLocation] converting data to internal representation');
	forge.logging.log(parsedData.geonames[0]);
	var locationInformation = parsedData.geonames[0].toponymName + ", " + parsedData.geonames[0].adminCode1 + ", " + parsedData.geonames[0].countryName;
	forge.logging.log('[buildLocation] Data conversion complete');
	return locationInformation;
}

function getLocationInfo(latitude, longitude, callback) {
	"use strict";
	forge.logging.log('[getLocationInfo] getting toponym for ' + latitude + ' , ' + longitude);
	forge.request.ajax({
		url: "http://api.geonames.org/findNearbyPlaceNameJSON?lat=" + latitude + "&lng=" + longitude + "&username=tmosleyIII&style=full",
		dataType: 'json',
		success: function (data, textStatus, jqXHR) {
			forge.logging.log('[getLocationInfo] success');
			var locationObj = buildLocation(data);
			callback(locationObj);
		},
		error: function (jqXHR, textStatus, errorThrown) {
			forge.logging.log('ERROR! [getLocationInfo] ' + textStatus);
		}
	});
}

function emptyContent() {
	"use strict";
	forge.logging.log('removing old data');
	$('#forecast_information').empty();
	$('#current_conditions').empty();
	$('#forecast_conditions table tr').empty();
	forge.logging.log('finished emptying content');
}

function setBadgeText(info) {
	"use strict";
	chrome.browserAction.setBadgeText({text:info});
}
function populateWeatherConditions(weatherCondition) {
	"use strict";
    var tmpl, output, temp;
	emptyContent();
    forge.logging.log('beginning populating weather conditions');
	//if (weatherCondition.currentConditions.temp_f) {
	//temp = weatherCondition.currentConditions.temp_f 
	//} else if (weatherCondition.currentConditions.temp_c) {
	//	temp = weatherCondition.currentConditions.temp_c
	//}
	temp = (weatherCondition.currentConditions.temp_f)? weatherCondition.currentConditions.temp_f : weatherCondition.currentConditions.temp_c;
	if (forge.is.chrome()) {
		setBadgeText(temp);
	};
    tmpl = $('#forecast_information_tmpl').html();
    output = Mustache.to_html(tmpl, weatherCondition.forecast);
    $('#forecast_information').append(output);
    forge.logging.log('finished populating forecast information');
    tmpl = $('#current_conditions_tmpl').html();
    output = Mustache.to_html(tmpl, weatherCondition.currentConditions);
    $('#current_conditions').append(output);
    forge.logging.log('finished populating current conditions');
    tmpl = $('#forecast_conditions_tmpl').html();
    output = Mustache.to_html(tmpl, {conditions: weatherCondition.forecastConditions});
    $('#forecast_conditions table').append(output);
    forge.logging.log('finished populating forecast conditions');
    forge.logging.log('finished populating weather conditions');
}

function populateLocation(locationName) {
	"use strict";
	forge.logging.log('[populateLocation] This is the callback ' + locationName);
	forge.prefs.set('city', locationName);
	getWeatherInfo(locationName, populateWeatherConditions);
	return locationName;
}

function getCurrentLocation() {
	"use strict";
	var latitude, longitude;
	forge.logging.log('[getCurrentLocation] Fetching current location');
	forge.geolocation.getCurrentPosition(
		function (position) {
			latitude = position.coords.latitude;
			longitude = position.coords.longitude;
			forge.logging.log('[getCurrentLocation] Grabbed location');
			getLocationInfo(latitude, longitude, populateLocation);
		},
		function (error) {
			forge.logging.log('ERROR! failed when retrieving current location');
		},
		{
			maximumAge: Infinity,
			timeout: 5000
		}
	);

}


$.widget('ui.myAutocomplete', $.extend({}, $.ui.autocomplete.prototype, {
    _suggest : function(items) {
        // Call ui.autocomplete's parent method
        $.ui.autocomplete.prototype._suggest.call(this, items);

        // Find the first list item
        var item = this.menu.element.children()[0];

        // Make this item active.
        // An event is expected so a fake one is passed as a parameter.
        this.menu.activate(new jQuery.Event('null.event'), $(item));
    }
}));



$(function () {
	"use strict";
	forge.prefs.get('city', function (resource) {
		if (resource) {
			getWeatherInfo(resource, populateWeatherConditions);
		} else { //default
			getWeatherInfo('Dayton', populateWeatherConditions);
		}
	},
		function () {
			forge.logging.log('ERROR! failed when retrieving city preferences');
		}
		);


	$("#city").myAutocomplete({
		source: function (request, response) {
			forge.request.ajax({
				url: "http://api.geonames.org/searchJSON?&username=tmosleyIII&style=full",
				dataType: "jsonp",
				data: {
					featureClass: "P",
					style: "full",
					maxRows: 12,
					name_startsWith: request.term
				},
				success: function (data) {
					response($.map(data.geonames, function (item) {
						return {
							label: item.name + (item.adminName1 ? ", " + item.adminName1 : "") + ", " + item.countryName,
							value: item.name
						};
					}));
				}
			});
		},
		minLength: 2,
		select: function (event, ui) {
			var auto_city = ui.item.label;
			forge.logging.log("auto_city value: " + auto_city);
			forge.prefs.set('city', auto_city);
			getWeatherInfo(auto_city, populateWeatherConditions);
		},
		open: function () {
			$(this).removeClass("ui-corner-all").addClass("ui-corner-top");
		},
		close: function () {
			$(this).removeClass("ui-corner-top").addClass("ui-corner-all");
		}
	}).keypress(function(e) {

          if (e.keyCode === 13) 
          {
            $(this).closest('form').trigger('submit');
          }

      });


	setInterval(function () {
		forge.prefs.get('city',
			getWeatherInfo(city, populateWeatherConditions),
			forge.logging.log('ERROR! failed when retrieving city preferences'));
	}, 900000);
});

