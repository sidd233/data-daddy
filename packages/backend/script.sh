#!/usr/bin/env bash

OUTPUT_FILE="api_context.md"
ROUTES_DIR="src/app/api"

# reset file
echo "# API Routes Context" > "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "This document contains all API route handlers extracted from the project." >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# find all route.ts files and sort them
find "$ROUTES_DIR" -type f -name "route.ts" | sort | while read -r file; do
    
    # derive route path
    route=$(echo "$file" | sed "s|$ROUTES_DIR||" | sed "s|/route.ts||")

    echo "--------------------------------------------------" >> "$OUTPUT_FILE"
    echo "## Route: $route" >> "$OUTPUT_FILE"
    echo "File: $file" >> "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE"
    echo "\`\`\`ts" >> "$OUTPUT_FILE"
    
    cat "$file" >> "$OUTPUT_FILE"
    
    echo "" >> "$OUTPUT_FILE"
    echo "\`\`\`" >> "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE"

done

echo "Context generated in $OUTPUT_FILE"