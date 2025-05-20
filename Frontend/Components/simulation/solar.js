'use strict';

const PI   = Math.PI,
      sin  = Math.sin,
      cos  = Math.cos,
      tan  = Math.tan,
      asin = Math.asin,
      atan = Math.atan2,
      acos = Math.acos,
      rad  = PI / 180;

const dayMs = 1000 * 60 * 60 * 24,
      J1970 = 2440588,
      J2000 = 2451545;

function toJulian(date) { return date.valueOf() / dayMs - 0.5 + J1970; }
function fromJulian(j)  { return new Date((j + 0.5 - J1970) * dayMs); }
function toDays(date)   { return toJulian(date) - J2000; }

const e = rad * 23.4397; 

function rightAscension(l, b) { return atan(sin(l) * cos(e) - tan(b) * sin(e), cos(l)); }
function declination(l, b)    { return asin(sin(b) * cos(e) + cos(b) * sin(e) * sin(l)); }

function azimuth(H, phi, dec)  { return atan(sin(H), cos(H) * sin(phi) - tan(dec) * cos(phi)); }
function altitude(H, phi, dec) { return asin(sin(phi) * sin(dec) + cos(phi) * cos(dec) * cos(H)); }

function siderealTime(d, lw) { return rad * (280.16 + 360.9856235 * d) - lw; }

function astroRefraction(h) {
    if (h < 0) 
        h = 0; 
    return 0.0002967 / Math.tan(h + 0.00312536 / (h + 0.08901179));
}

// general sun calculations

function solarMeanAnomaly(d) { return rad * (357.5291 + 0.98560028 * d); }

function eclipticLongitude(M) {
    var C = rad * (1.9148 * sin(M) + 0.02 * sin(2 * M) + 0.0003 * sin(3 * M)), 
        P = rad * 102.9372; 
    return M + C + P + PI;
}

function sunCoords(d) {
    var M = solarMeanAnomaly(d),
        L = eclipticLongitude(M);
    return {
        dec: declination(L, 0),
        ra: rightAscension(L, 0)
    };
}

const SunCalc = {};

/**
 * Get solar azimuth and altitude for given date and coordinates
 * @param {Date} date 
 * @param {number} lat Latitude in degrees
 * @param {number} lng Longitude in degrees
 * @returns { azimuth: number, altitude: number }
 */
SunCalc.getPosition = function (date, lat, lng) {
    var lw  = rad * -lng,
        phi = rad * lat,
        d   = toDays(date),
        c  = sunCoords(d),
        H  = siderealTime(d, lw) - c.ra;

    return {
        azimuth: azimuth(H, phi, c.dec),
        altitude: altitude(H, phi, c.dec)
    };
};

/**
 * Get solar position for a location by geocoding the address
 * @param {string} street 
 * @param {string} city 
 * @param {string} postal 
 * @param {Date} date
 * @returns {Promise<{azimuth: number, altitude: number}>}
 */
SunCalc.getSolarPositionForLocation = async function (street, city, postal, date) {
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(street)},${encodeURIComponent(city)},${encodeURIComponent(postal)}`);
        if (!response.ok) throw new Error('Geocoding failed');
        const data = await response.json();
        if (!data.length) throw new Error('No geocode results found');

        const { lat, lon } = data[0];
        const latitude = parseFloat(lat);
        const longitude = parseFloat(lon);

        if (isNaN(latitude) || isNaN(longitude)) throw new Error('Invalid coordinates');

        return SunCalc.getPosition(date, latitude, longitude);
    } catch (error) {
        throw new Error(`Failed to get solar position: ${error.message}`);
    }
};

export default SunCalc;