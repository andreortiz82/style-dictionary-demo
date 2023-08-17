const StyleDictionary = require("style-dictionary");
const baseConfig = require("./style-dictionary.config.json");
const _ = require("lodash");

/**
 * Converts the rgb object from `inputJson` to HEX string
 */
const rgbToHex = (rgb) => {
  // https://github.com/Ahmad-Amin/figmaPlugin/blob/f27c57245a51248857df4cf278c5599508c517f2/src/class_functions/classes/classes.js
  let r = rgb.r;
  let g = rgb.g;
  let b = rgb.b;

  //figma gives rgb values in [0,1] we convert it to [1,255]
  r = Math.round(rgb.r * 255);
  g = Math.round(rgb.g * 255);
  b = Math.round(rgb.b * 255);

  //rgb values to hexadecimal values
  r = r.toString(16);
  g = g.toString(16);
  b = b.toString(16);
  if (r.length == 1) r = "0" + r;
  if (g.length == 1) g = "0" + g;
  if (b.length == 1) b = "0" + b;
  return `#${r.toUpperCase() + g.toUpperCase() + b.toUpperCase()}`;
};

/**
 * Parses the JSON file defined in the `style-dictionary.config.json`
 * JSON is downloaded from this Community Plugin: https://www.figma.com/community/plugin/1253571037276959291
 */
function toStyleDictionaryFormat(inputJson, filePath) {
  const styleDictionary = {};
  const collection = _.kebabCase(inputJson.name);
  const modes = inputJson.modes;
  const variables = inputJson.variables;

  for (const mode in modes) {
    variables.map((variable) => {
      const modeName = _.kebabCase(modes[mode]);
      const newVarName = _.kebabCase(
        `${collection}-${modeName}-${variable.name}`
      );

      styleDictionary[newVarName] = {
        ...variable,
        name: newVarName,
        collection: collection,
        file: filePath,
        mode: modeName,
        value: variable.resolvedValuesByMode[mode].resolvedValue,
        alias: _.kebabCase(variable.resolvedValuesByMode[mode].aliasName),
      };
    });
  }

  return styleDictionary;
}

StyleDictionary.registerParser({
  pattern: /\.json$/,
  parse: ({ filePath, contents }) => {
    return toStyleDictionaryFormat(JSON.parse(contents), filePath);
  },
});

/**
 * StyleDictionary: Transforms
 * ----------------------------------------
 */
StyleDictionary.registerTransform({
  name: "name-transform",
  type: "name",
  transformer: (token) => {
    let newName = token.name.replace("mode-1-", "");
    newName = newName.replace("typography-", "");
    newName = newName.replace("effects-", "");
    return newName;
  },
});

StyleDictionary.registerTransform({
  name: "px-value-transform",
  type: "value",
  matcher: (token) => {
    return (
      token.collection.includes("size") ||
      token.collection.includes("breakpoint") ||
      token.collection.includes("border") ||
      token.collection.includes("space")
    );
  },
  transformer: (token) => {
    return `${token.value}px`;
  },
});

StyleDictionary.registerTransform({
  name: "rem-value-transform",
  type: "value",
  matcher: (token) => {
    return token.collection.includes("typography");
  },
  transformer: (token) => {
    if (token.name.includes("font-size-")) {
      return `${token.value}rem`;
    } else {
      return token.value;
    }
  },
});

StyleDictionary.registerTransform({
  name: "name-transform",
  type: "name",
  transformer: (token) => {
    let newTokenName = token.name;
    return newTokenName;
  },
});

StyleDictionary.registerTransform({
  name: "value-transform",
  type: "value",
  transformer: (token) => {
    let newTokenValue = token.value;
    if (token.collection === "semantic")
      newTokenValue = `var(--${token.alias}, ${rgbToHex(token.value)})`;
    if (token.collection === "foundation")
      newTokenValue = rgbToHex(token.value);
    if (token.collection === "size") newTokenValue = `${newTokenValue}px`;

    return newTokenValue;
  },
});

StyleDictionary.registerTransformGroup({
  name: "custom/group",
  transforms: ["name-transform", "value-transform"],
});

/**
 * StyleDictionary: Formats
 * ----------------------------------------
 */
StyleDictionary.registerFormat({
  name: "custom/css",
  formatter: function ({ dictionary, file, options }) {
    let collections = [];

    dictionary.allTokens.map((token) => {
      const collectionName = _.camelCase(token.collection);
      if (!collections.includes(token.collection)) {
        collections.push(token.collection);
      }
    });

    let output = collections
      .map((c) => {
        return `/* ${_.camelCase(c)} */
      ${dictionary.allTokens
        .filter((tkn) => {
          return tkn.collection === c;
        })
        .map((token) => {
          return `--${token.name} : ${token.value};`;
        })
        .join("\n")}
    \n`;
      })
      .join("");

    return `/* Generated by friendly robots. */\n\n:root {\n${output}\n}`;
  },
});

const StyleDictionaryExtended = StyleDictionary.extend(baseConfig);
StyleDictionaryExtended.buildAllPlatforms();
