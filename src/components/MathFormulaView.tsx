import React, { useState } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { WebView } from 'react-native-webview';

interface MathFormulaViewProps {
  content: string;
  fontSize?: number;
  textColor?: string;
  minHeight?: number;
}

export const MathFormulaView: React.FC<MathFormulaViewProps> = ({
  content,
  fontSize = 15,
  textColor = '#1E293B',
  minHeight = 24,
}) => {
  const [webViewHeight, setWebViewHeight] = useState(minHeight);

  // If content contains no LaTeX ($ or \), we can render it fast as plain Text
  const hasLatex = content.includes('$') || content.includes('\\(') || content.includes('\\[') || content.includes('\\frac');

  if (!hasLatex) {
    return (
      <View style={styles.plainContainer}>
        <Text style={[styles.plainText, { fontSize, color: textColor }]}>
          {content}
        </Text>
      </View>
    );
  }

  // Escape HTML characters before rendering KaTeX
  const escapedContent = JSON.stringify(content);

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css">
        <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.js"></script>
        <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/contrib/auto-render.min.js"></script>
        <style>
          * { box-sizing: border-box; }
          body {
            margin: 0;
            padding: 2px 4px;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            font-size: ${fontSize}px;
            color: ${textColor};
            line-height: 1.5;
            background-color: transparent;
            word-wrap: break-word;
          }
          .katex-display {
            margin: 6px 0;
            overflow-x: auto;
            overflow-y: hidden;
          }
        </style>
      </head>
      <body>
        <div id="content"></div>
        <script>
          document.addEventListener("DOMContentLoaded", function() {
            var raw = ${escapedContent};
            var el = document.getElementById('content');
            el.innerText = raw;
            renderMathInElement(el, {
              delimiters: [
                {left: '$$', right: '$$', display: true},
                {left: '$', right: '$', display: false},
                {left: '\\\\(', right: '\\\\)', display: false},
                {left: '\\\\[', right: '\\\\]', display: true}
              ],
              throwOnError: false
            });
            setTimeout(function() {
              var height = document.documentElement.scrollHeight || document.body.scrollHeight;
              window.ReactNativeWebView.postMessage(JSON.stringify({ height: height }));
            }, 50);
          });
        </script>
      </body>
    </html>
  `;

  return (
    <View style={[styles.container, { height: Math.max(minHeight, webViewHeight) }]}>
      <WebView
        originWhitelist={['*']}
        source={{ html }}
        scrollEnabled={false}
        showsVerticalScrollIndicator={false}
        showsHorizontalIndicator={false}
        style={styles.webView}
        containerStyle={{ backgroundColor: 'transparent' }}
        onMessage={(event) => {
          try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data?.height && data.height > 0) {
              setWebViewHeight(Math.ceil(data.height) + 6);
            }
          } catch {
            // Ignore parse errors
          }
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    overflow: 'hidden',
  },
  webView: {
    backgroundColor: 'transparent',
  },
  plainContainer: {
    paddingVertical: 2,
  },
  plainText: {
    lineHeight: 22,
  },
});

