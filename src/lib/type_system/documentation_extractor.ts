// Documentation extraction from JSDoc comments using ts-morph

import {
  FunctionDeclaration,
  InterfaceDeclaration,
  JSDoc,
  PropertySignature,
} from "ts-morph";
import type {
  FunctionDocumentation,
  InterfaceDocumentation,
} from "./types.ts";

/**
 * Extracts documentation from TypeScript nodes
 */
export class DocumentationExtractor {
  /**
   * Extract JSDoc documentation from a function
   */
  extractFunctionDocumentation(
    func: FunctionDeclaration
  ): FunctionDocumentation | undefined {
    const jsDocs = func.getJsDocs();
    if (jsDocs.length === 0) {
      return undefined;
    }

    const doc: FunctionDocumentation = {};

    for (const jsDoc of jsDocs) {
      // Extract description
      const description = this.extractDescription(jsDoc);
      if (description) {
        doc.description = description;
      }

      // Extract @param tags
      const paramTags = jsDoc.getTags().filter((tag) => tag.getTagName() === "param");
      if (paramTags.length > 0) {
        doc.paramDescriptions = {};
        for (const tag of paramTags) {
          const paramName = this.extractParamName(tag.getText());
          const paramDesc = this.extractParamDescription(tag.getText());
          if (paramName && paramDesc) {
            doc.paramDescriptions[paramName] = paramDesc;
          }
        }
      }

      // Extract @returns or @return tag
      const returnTag = jsDoc.getTags().find((tag) =>
        tag.getTagName() === "returns" || tag.getTagName() === "return"
      );
      if (returnTag) {
        const returnDesc = this.extractTagDescription(returnTag.getText());
        if (returnDesc) {
          doc.returnDescription = returnDesc;
        }
      }

      // Extract @example tags
      const exampleTags = jsDoc.getTags().filter((tag) => tag.getTagName() === "example");
      if (exampleTags.length > 0) {
        doc.examples = exampleTags.map((tag) => this.extractTagDescription(tag.getText()) || "");
      }

      // Extract @deprecated tag
      const deprecatedTag = jsDoc.getTags().find((tag) => tag.getTagName() === "deprecated");
      if (deprecatedTag) {
        doc.deprecated = this.extractTagDescription(deprecatedTag.getText()) || "This function is deprecated";
      }

      // Extract other tags
      const otherTags = jsDoc.getTags().filter((tag) => {
        const tagName = tag.getTagName();
        return !["param", "returns", "return", "example", "deprecated"].includes(tagName);
      });
      if (otherTags.length > 0) {
        doc.tags = {};
        for (const tag of otherTags) {
          const tagName = tag.getTagName();
          const tagValue = this.extractTagDescription(tag.getText()) || "";
          doc.tags[tagName] = tagValue;
        }
      }
    }

    return Object.keys(doc).length > 0 ? doc : undefined;
  }

  /**
   * Extract JSDoc documentation from an interface
   */
  extractInterfaceDocumentation(
    iface: InterfaceDeclaration
  ): InterfaceDocumentation | undefined {
    const jsDocs = iface.getJsDocs();
    if (jsDocs.length === 0) {
      return undefined;
    }

    const doc: InterfaceDocumentation = {};

    for (const jsDoc of jsDocs) {
      // Extract description
      const description = this.extractDescription(jsDoc);
      if (description) {
        doc.description = description;
      }

      // Extract @deprecated tag
      const deprecatedTag = jsDoc.getTags().find((tag) => tag.getTagName() === "deprecated");
      if (deprecatedTag) {
        doc.deprecated = this.extractTagDescription(deprecatedTag.getText()) || "This interface is deprecated";
      }

      // Extract other tags
      const otherTags = jsDoc.getTags().filter((tag) => {
        const tagName = tag.getTagName();
        return !["deprecated"].includes(tagName);
      });
      if (otherTags.length > 0) {
        doc.tags = {};
        for (const tag of otherTags) {
          const tagName = tag.getTagName();
          const tagValue = this.extractTagDescription(tag.getText()) || "";
          doc.tags[tagName] = tagValue;
        }
      }
    }

    // Extract property descriptions
    const properties = iface.getProperties();
    if (properties.length > 0) {
      const propertyDescriptions: Record<string, string> = {};
      for (const prop of properties) {
        const propDoc = this.extractPropertyDocumentation(prop);
        if (propDoc) {
          propertyDescriptions[prop.getName()] = propDoc;
        }
      }
      if (Object.keys(propertyDescriptions).length > 0) {
        doc.propertyDescriptions = propertyDescriptions;
      }
    }

    return Object.keys(doc).length > 0 ? doc : undefined;
  }

  /**
   * Extract documentation from an interface property
   */
  extractPropertyDocumentation(prop: PropertySignature): string | undefined {
    const jsDocs = prop.getJsDocs();
    if (jsDocs.length === 0) {
      return undefined;
    }

    // Get the first JSDoc comment's description
    const description = this.extractDescription(jsDocs[0]);
    return description || undefined;
  }

  /**
   * Extract the description from a JSDoc comment
   */
  private extractDescription(jsDoc: JSDoc): string | undefined {
    const description = jsDoc.getDescription().trim();
    return description || undefined;
  }

  /**
   * Extract parameter name from @param tag text
   * Format: "@param paramName description" or "@param {type} paramName description"
   */
  private extractParamName(tagText: string): string | undefined {
    // Remove "@param" prefix
    const text = tagText.replace(/^@param\s+/, "");

    // Handle {@type} syntax
    const withoutType = text.replace(/^\{[^}]+\}\s*/, "");

    // Extract first word as parameter name
    const match = withoutType.match(/^(\w+)/);
    return match ? match[1] : undefined;
  }

  /**
   * Extract parameter description from @param tag text
   */
  private extractParamDescription(tagText: string): string | undefined {
    // Remove "@param" prefix
    const text = tagText.replace(/^@param\s+/, "");

    // Handle {@type} syntax
    const withoutType = text.replace(/^\{[^}]+\}\s*/, "");

    // Remove parameter name and extract description
    const match = withoutType.match(/^\w+\s+(.+)$/);
    return match ? match[1].trim() : undefined;
  }

  /**
   * Extract description from any tag text
   */
  private extractTagDescription(tagText: string): string | undefined {
    // Remove tag name (e.g., "@returns", "@example")
    const text = tagText.replace(/^@\w+\s*/, "");

    // Remove optional type annotation
    const withoutType = text.replace(/^\{[^}]+\}\s*/, "");

    return withoutType.trim() || undefined;
  }
}