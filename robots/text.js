const algorithmia = require('algorithmia')
const algorithmiaApiKey = require('../credentials/algorithmia.json').apiKey
const sentenceBounderyDetection = require('sbd')

const watsonApiKey = require('../credentials/watson-nlu.json').apiKey
const NaturalLanguageUnderstandingV1 = require('watson-developer-cloud/natural-language-understanding/v1.js')

var nlu = new NaturalLanguageUnderstandingV1({
    iam_apikey: watsonApiKey,
    username: 'alexandre@fabsoft.com.br',
    password: '@Lm20mds07',
    version: '2018-11-16',
    url: 'https://gateway.watsonplatform.net/natural-language-understanding/api'
})

/*
    username: 'alexandre@fabsoft.com.br',
    password: '@Lm20mds07',
    version: '2018-04-05',

*/ 

async function robot(content) {
    await fetchContentFromWikipedia(content)
    sanitizeContent(content)
    breakContentIntoSentences(content)
    limitMaximumSentences(content)
    await fetchKeywordsOfAllSentences(content)

    async function fetchContentFromWikipedia(content){
        const algorithmiaAuthenticated = algorithmia(algorithmiaApiKey)
        const wikipediaAlgorithm = algorithmiaAuthenticated.algo('web/WikipediaParser/0.1.2')
        const wikipediaResponse = await wikipediaAlgorithm.pipe(content.searchTerm)
        const wikipediaContent = wikipediaResponse.get()
        
        content.sourceContentOriginal = wikipediaContent.content
    }
    function sanitizeContent(content){
        const withoutBlankLinesAndMarkdown = removeBlankLinesAndMarkdown(content.sourceContentOriginal)
        const withoutDatesInParentheses = removeDatesInParenteses(withoutBlankLinesAndMarkdown)

        content.sourceContentSanitized = withoutDatesInParentheses
 
        function removeBlankLinesAndMarkdown(text) {
            const allLines = text.split('\n')
            const withoutBlankLinesAndMarkdown = allLines.filter(line => {
                if(line.trim().length === 0 || line.trim().startsWith('=')){
                    return false
                }
                return true
            })
            return withoutBlankLinesAndMarkdown.join(' ')
        } 
        function removeDatesInParenteses(text){
            return text.replace(/\((?:\([^()]*\)|[^()])*\)/gm,'').replace(/ /g,' ')
        }
    }
    function breakContentIntoSentences(content){
        content.sentences = []

        const sentences = sentenceBounderyDetection.sentences(content.sourceContentSanitized)
        sentences.forEach((sentence) => {
            content.sentences.push({
                text: sentence,
                keywords:[],
                images:[]
            })
        })
    }

    async function fetchKeywordsOfAllSentences(content){
        for (const sentence of content.sentences){
            sentence.keyword = await fetchWatsonAndReturnKeywords(sentence.text)
        }        
    }

    async function fetchWatsonAndReturnKeywords(sentence){
        return new Promise((resolve, reject) => {
            nlu.analyze({
                text: sentence,
                features: {
                    keywords: {}
                }
            }, (error, response) => {
                if(error) {
                    // throw error
                    console.log(error);
                    return;
                }

                const keywords = response.keywords.map((keyword) => {
                    return keyword.text
                })
    
                resolve(keywords)
            })
        })
    }    

    function limitMaximumSentences(content){
        content.sentences = content.sentences.slice(0,content.maximumSentences)
    }
}

module.exports = robot