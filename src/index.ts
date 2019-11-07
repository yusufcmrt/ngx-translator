import Axios from 'axios';
import {Command, flags} from '@oclif/command';
import {readFileSync, writeFileSync} from 'fs';

interface JsonTypeDefine<T> {
  [key: string]: T | JsonTypeDefine<T>;
}

interface JsonType extends JsonTypeDefine<string> {
}

interface TranslateParam {
  key: string;
  target: string;
  q?: string;
}

class NgxTranslator extends Command {
  static description = 'describe the command here';

  static flags = {
    // add --version flag to show CLI version
    version: flags.version({char: 'v'}),
    help: flags.help({char: 'h'}),

    merge: flags.boolean({char: 'm', description: 'merge with existing destination file'}),
    apiKey: flags.string({char: 'k', description: 'google translate api key', required: true}),
  };

  static args = [
    {name: 'target_lang', required: true},
    {name: 'source_file', required: true},
    {name: 'destination_file'},
  ];

  private totalProcess = 0;

  async run() {
    const {args, flags} = this.parse(NgxTranslator);

    args.destination_file = args.destination_file || (args.target_lang + '.json');

    const sourceText = readFileSync(args.source_file, 'utf-8');
    const sourceJson = JSON.parse(sourceText);

    let destinationJson = {};
    if (flags.merge) {
      const destinationText = readFileSync(args.destination_file, 'utf-8');
      destinationJson = JSON.parse(destinationText);
    }

    const param: TranslateParam = {
      key: flags.apiKey,
      target: args.target_lang,
    };

    this.totalProcess = await this.countTotalProcess(sourceJson, destinationJson);
    if (this.totalProcess) {
      await this.translator(sourceJson, destinationJson, param);

      writeFileSync(args.destination_file, JSON.stringify(destinationJson, null, 2), 'utf-8');
      this.log();
      this.log('Translate complete...');
    } else {
      this.log('Already fully translated');
    }

  }

  private async translator(data: JsonType, res: JsonType, param: TranslateParam) {
    let counter = 0;
    await this.spider(data, res, async (_data, _res, _key) => _res[_key] = await this.getTranslate(_data[_key] as string, param, ++counter));
  }

  private async countTotalProcess(data: JsonType, res: JsonType) {
    let counter = 0;
    await this.spider(data, res, async (_data, _res, _key) => counter++);
    return counter;
  }

  private async spider(data: JsonType, res: JsonType, doSomething: (data: JsonType, res: JsonType, key: string) => void) {
    const keys = Object.keys(data);
    for (const key of keys) {
      if (typeof data[key] === 'string' && (!res.hasOwnProperty(key) || typeof res[key] !== 'string')) {
        await doSomething(data, res, key);
      } else if (typeof data[key] !== 'string') {
        res[key] = !res.hasOwnProperty(key) || typeof res[key] === 'string' ? {} : res[key];
        await this.spider(data[key] as JsonType, res[key] as JsonType, doSomething);
      }
    }
  }

  private async getTranslate(text: string, param: TranslateParam, i: number): Promise<string> {
    process.stdout.write('\rProcessing: %' + Math.trunc(i / this.totalProcess * 100));
    const res = await Axios.get('https://translation.googleapis.com/language/translate/v2', {
      params: {
        ...param,
        q: text
      }
    });
    return res.data.data.translations[0].translatedText;
  }
}

export = NgxTranslator;
